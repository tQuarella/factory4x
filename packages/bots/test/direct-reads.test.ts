import { describe, expect, it } from 'vitest';
import { BUILD_TYPES, allocStatus, createWorld, defaultData, fleetStatus, heartIndex, rockStatus, step } from '@factory4x/sim';
import { fieldMix } from '../src/field-estimate.ts';
import { adaptive, anyBayRunning, econAliveNow, econCounts, openSlots, weightInputs, type Weights } from '../src/field-strategies.ts';
import { minMix } from '../src/waves.ts';

/**
 * cw-bots-gate-time: the bots read the world directly where they used to build whole selector sheets every tick.
 * These tests hold the direct reads to the selectors' numbers along a played run, so a sim change that moves one
 * and not the other fails here and not in a silent bot-decision change.
 */
const data = defaultData;

describe('the direct reads equal the selectors', () => {
  it('econCounts, econAliveNow, openSlots, anyBayRunning and weightInputs match fleetStatus, rockStatus and allocStatus every 7th tick of an adaptive run', () => {
    const w = createWorld(2, data);
    const bot = adaptive.make(data);
    const target: Weights = { extractor: 3, hauler: 2, drone: 5, lancer: 0, flak: 1 };
    let checked = 0;
    for (let i = 0; i < 12 * 60 * data.tickRate; i++) {
      step(w, data, bot.decide(w, data));
      if (i % 7 !== 0) continue;
      const f = fleetStatus(w, data);
      expect(econCounts(w, data)).toEqual({ extractor: f.econByType.extractor + f.econBuildingByType.extractor, hauler: f.econByType.hauler + f.econBuildingByType.hauler });
      expect(econAliveNow(w, data)).toBe(f.econByType.extractor + f.econByType.hauler);
      let slots = 0;
      for (const n of w.nodes) {
        if (n.kind === 'probe') continue;
        const r = rockStatus(w, n.index);
        if (r.mineable) slots += Math.max(0, r.slots - r.freeExtractors);
      }
      expect(openSlots(w)).toBe(slots);
      const rows = allocStatus(w, data).rows;
      expect(anyBayRunning(w)).toBe(rows.some((r) => r.ticksLeft > 0));
      const old = BUILD_TYPES.filter((t, k) => rows[k]!.weight !== Math.max(0, Math.min(w.tun['alloc.maxWeight'], target[t])));
      expect(weightInputs(w, data, target).map((x) => (x.type === 'setAlloc' ? x.shipType : null))).toEqual(old);
      checked++;
    }
    expect(checked).toBeGreaterThan(1000);
  });
});

describe('the shared battle memo changes no answer', () => {
  it('fieldMix with a limit raised after a smaller one equals a fresh minMix, for each type set', () => {
    const w = createWorld(1, data);
    const hive = heartIndex(w);
    const ALL = ['drone', 'lancer', 'flak'] as const;
    for (const upTo of [12, 40, 25, 60]) {
      for (const types of [ALL, ['drone', 'flak'] as const, ['drone'] as const]) {
        const a = fieldMix(w, data, hive, types, upTo);
        const inert = createWorld(1, data);
        inert.tun['raid.enabled'] = 0;
        inert.tun['economy.probeOrePerMin'] = 0;
        inert.stock.ore = 0;
        for (const t of BUILD_TYPES) {
          inert.field!.alloc[t] = 0;
          inert.field!.share[t] = 0;
        }
        inert.field!.mine = inert.field!.mine.map(() => false);
        inert.field!.econ = [];
        expect(a, `${types.join(',')} upTo ${upTo}`).toEqual(minMix(inert, hive, types, upTo, data));
      }
    }
  });
});
