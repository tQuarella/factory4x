import { describe, expect, it } from 'vitest';
import { createWorld, hashState, parseSimData, step, type Input, type World } from '../src/index.ts';
import raw13 from './fixtures/sim-v13.json' with { type: 'json' };
import { F } from './field-helpers.ts';

/**
 * h8-sim acceptance 3, last item: hauler.autoNeed 0 reproduces H7's F6 on the frozen v13 fixture (DESIGN.md H8 H5).
 *
 * The H7 hauler tests (field.test.ts "F6 haulers", on the v12 fixture, which carries hauler.autoNeed 0) pass
 * unchanged. This adds a whole-run check: the shipped v13 opening, with a Stop and re-mark of a1, a hauler weight
 * change and a hauler recycle, played for 6 game minutes on the H8 code with hauler.autoNeed 0, gives at every
 * 600th tick the same state hash as the v13 code (commit 0291294, before any H8 change) gave for the same inputs.
 * The hash covers the whole world except what H8 added (`field.haulerSet` and the six H8 sim tunables), so any
 * change H8 made to how an H7 world plays shows here.
 *
 * The pinned list was produced by running this same loop against 0291294's packages/sim/src and its v13 fixture.
 */
const D13 = parseSimData(raw13);
const T = 1800;
const H8_SIM_KEYS = ['hauler.autoNeed', 'hauler.needPct', 'rock.haulerMax', 'raid.shieldEcon', 'raid.haulersHold', 'move.splitPct'];

/** The world without what H8 added. */
function h7Hash(w: World): string {
  const c = JSON.parse(JSON.stringify(w)) as { field: Record<string, unknown>; tun: Record<string, unknown> };
  delete c.field.haulerSet;
  for (const k of H8_SIM_KEYS) delete c.tun[k];
  return hashState(c);
}

function inputsAt(t: number): Input[] {
  if (t === 3 * T) return [{ type: 'setMine', node: F.a1, on: false }];
  if (t === 3 * T + 150) return [{ type: 'setMine', node: F.a1, on: true }];
  if (t === 4 * T) return [{ type: 'setAlloc', shipType: 'hauler', weight: 4 }];
  // A hauler is at the probe (it arrived the tick before) at 7272 on the v13 rules.
  if (t === 7272) return [{ type: 'recycleShips', node: 0, counts: { drone: 0, lancer: 0, flak: 0, hauler: 1 } }];
  return [];
}

/** Hashes from 0291294 (v13 rules), every 600 ticks over 6 game minutes. */
const V13_HASHES = [
  '20a0d709', '0e797237', '3f5a2abf', '52530e82', 'aadd4b36', 'c540293a', '82e30873', 'e389141d', '9f497909',
  '16914459', 'a7c04698', 'e900b9ce', '4e2f3245', '31f4939c', '25c6b49b', '0a2df3b5', '9f8e7362', '06f3c72c',
];

describe('hauler.autoNeed 0 is H7 (H5)', () => {
  it('the frozen v13 fixture carries hauler.autoNeed 0, raid.shieldEcon 0 and raid.haulersHold 0 (H7 behaviour)', () => {
    expect([D13.tunables['hauler.autoNeed'].default, D13.tunables['raid.shieldEcon'].default, D13.tunables['raid.haulersHold'].default]).toEqual([0, 0, 0]);
  });

  it('6 game minutes of the shipped v13 opening, with a Stop, a re-mark, a weight change and a recycle, match the v13 code hash for hash', () => {
    const w = createWorld(1, D13);
    const out: string[] = [];
    for (let t = 0; t < 6 * T; t++) {
      step(w, D13, inputsAt(t));
      if ((t + 1) % 600 === 0) out.push(h7Hash(w));
    }
    // The inputs did something: a1 is marked again, the hauler weight is 4, and the recycle at the probe took a hauler.
    expect([w.field!.mine[F.a1], w.field!.alloc.hauler, w.stats.econRecycled.hauler]).toEqual([true, 4, 1]);
    expect(out).toEqual(V13_HASHES);
  });
});
