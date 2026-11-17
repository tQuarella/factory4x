import { createWorld, type ShipType, type SimData, type World } from '@factory4x/sim';
import { fieldMix, fieldSingle, fullRaidAwayCounts, hiveNode } from './field-estimate.ts';
import type { FieldResult } from './field-runner.ts';
import { openSlots } from './field-strategies.ts';

/**
 * The seven H7 capability flags (DESIGN.md "Bots (H7): strategies"). Each measures what can or can't be done,
 * never minutes, and is reported, never gated. Flags 1-3 read the runs; flags 4-7 read the min-wave estimate on a
 * fresh field (the shipped tunables) and, for flag 6, the haulers `adaptive` ran at its peak.
 */
export interface FieldFlag {
  name: string;
  pass: boolean;
  detail: string;
  /** A reported finding, not a target (H9 targets 5a and 5b, Director 2026-11-16): printed REPORTED, never MET or MISSED. */
  reported?: boolean;
}

const ALL: readonly ShipType[] = ['drone', 'lancer', 'flak'];

const rowsOf = (results: readonly FieldResult[], name: string): FieldResult[] => results.filter((r) => r.strategy === name);
const lostTotal = (r: FieldResult): number => r.econLost.extractor + r.econLost.hauler;
const builtTotal = (r: FieldResult): number => r.econBuilt.extractor + r.econBuilt.hauler;

/** The flags from the runs (all seeds) and the shipped data. */
export function computeFieldFlags(results: readonly FieldResult[], data: SimData): FieldFlag[] {
  const flags: FieldFlag[] = [];
  const fresh: World = createWorld(1, data);
  const hive = hiveNode(fresh);
  const cap = fresh.tun['field.fleetCap'];
  const upTo = cap > 0 ? cap + 10 : 60;
  const NO_RUNS = 'no runs';

  // 1. Splitting matters.
  {
    const st = rowsOf(results, 'static');
    const ad = rowsOf(results, 'adaptive');
    const staticOk = (r: FieldResult): boolean => r.outcome !== 'won' || lostTotal(r) * 2 >= builtTotal(r);
    const pass = st.length > 0 && ad.length > 0 && st.every(staticOk) && ad.every((r) => r.outcome === 'won');
    flags.push({
      name: 'Splitting matters: static either loses at least half the economy ships it built to raids or fails to take the hive within the cap, and adaptive takes the hive',
      pass,
      detail:
        st.length === 0 || ad.length === 0
          ? NO_RUNS
          : `${st.map((r) => `static/${r.seed}${r.variant === null ? '' : ` (${r.variant})`} ${r.outcome === 'won' ? 'won' : r.outcome}, lost ${lostTotal(r)} of ${builtTotal(r)} economy ships ${staticOk(r) ? 'ok' : 'MISS'}`).join('; ')}; ${ad.map((r) => `adaptive/${r.seed} ${r.outcome}`).join(', ')}`,
    });
  }

  // 2. Greed is answered by raids.
  {
    const gr = rowsOf(results, 'greedy');
    const firstHit = (r: FieldResult): number | null => r.raidLog.find((x) => x.outcome === 'hit')?.econLost ?? null;
    const ok = (r: FieldResult): boolean => (firstHit(r) ?? 0) >= 2 && r.outcome === 'won';
    flags.push({
      name: "Greed is answered by raids: greedy's first hitting raid kills at least 2 economy ships, and greedy still wins after responding",
      pass: gr.length > 0 && gr.every(ok),
      detail: gr.length === 0 ? NO_RUNS : gr.map((r) => `greedy/${r.seed} first hit killed ${firstHit(r) ?? 'no hit'}, ${r.outcome} ${ok(r) ? 'ok' : 'MISS'}`).join('; '),
    });
  }

  // 3. Waiting is safe.
  {
    const id = rowsOf(results, 'idle');
    const ok = (r: FieldResult): boolean => r.raids.mustered <= 1;
    flags.push({
      name: 'Waiting is safe: idle is raided at most once',
      pass: id.length > 0 && id.every(ok),
      detail: id.length === 0 ? NO_RUNS : id.map((r) => `idle/${r.seed} raids mustered ${r.raids.mustered} (hit ${r.raids.hit}, beaten ${r.raids.beaten}, turned back ${r.raids.turnedBack}) ${ok(r) ? 'ok' : 'MISS'}`).join('; '),
    });
  }

  // 4. The counter-attack window is real.
  {
    const full = fieldMix(fresh, data, hive, ALL, upTo);
    const away = fullRaidAwayCounts(fresh, hive);
    const small = fieldMix(fresh, data, hive, ALL, upTo, away.home);
    // At least 30% smaller: away <= 70% of full (integer test). A hive no mix within the search takes counts as bigger than any.
    const pass = small !== null && (full === null || small.total * 100 <= full.total * 70);
    flags.push({
      name: "The counter-attack window is real: the hive's smallest winning wave with a full-size raid out is at least 30% smaller than at full strength",
      pass,
      detail: `best mix at full strength ${full === null ? `none within ${upTo}` : full.total}; with a raid of ${away.raid.thorn} Thorns and ${away.raid.spore} Spores out ${small === null ? `none within ${upTo}` : small.total}`,
    });
  }

  // 5. Counters matter.
  {
    const single = fieldSingle(fresh, data, hive, 'drone', cap > 0 ? cap : 60);
    const room = cap - 10;
    flags.push({
      name: `Counters matter: drones-only can't take the hive within field.fleetCap minus 10 economy ships (its best drone wave doesn't fit)`,
      pass: single === null || single > room,
      detail: `smallest drone wave ${single === null ? `none within ${cap}` : single} against ${room} warship slots (field.fleetCap ${cap} minus 10)`,
    });
  }

  // 6. Economy against offence is a trade in slots.
  {
    const best = fieldMix(fresh, data, hive, ALL, upTo);
    const haulers = Math.max(0, ...rowsOf(results, 'adaptive').map((r) => r.peakHaulers));
    const slots = openSlots(fresh);
    const fullEcon = slots + haulers;
    const pass = best !== null && best.total + fullEcon > cap && best.total + 10 <= cap;
    flags.push({
      name: "Economy against offence is a trade in slots: the hive's best mix plus a full economy is more than field.fleetCap, and the best mix plus 10 economy ships fits",
      pass,
      detail: `best mix ${best === null ? `none within ${upTo}` : best.total}; full economy ${fullEcon} (${slots} Mine slots plus ${haulers} haulers at adaptive's peak); field.fleetCap ${cap}; best mix + full economy = ${best === null ? '-' : best.total + fullEcon}, best mix + 10 = ${best === null ? '-' : best.total + 10}`,
    });
  }

  // 7. No free first win (F13), reported per guarded node.
  {
    const free = Math.floor(fresh.tun['economy.startStock'] / fresh.tun['ship.drone.cost']);
    const rows: string[] = [];
    let pass = true;
    for (const g of fresh.guardians) {
      const need = fieldSingle(fresh, data, g.node, 'drone', free + 1);
      const ok = need === null || need > free;
      if (!ok) pass = false;
      rows.push(`${fresh.nodes[g.node]!.id} needs ${need === null ? `more than ${free + 1}` : need} drones (${free} buyable from the opening stock) ${ok ? 'ok' : 'MISS'}`);
    }
    flags.push({
      name: 'No free first win: every guarded node needs more drones than the opening stock buys',
      pass,
      detail: rows.join('; '),
    });
  }
  return flags;
}

// ---- The two H9 report lines (DESIGN.md "Calibration targets (H9)" 4 and 5) -------------------------------------

/** A run's raids by prong count (a raid that did not split is 1), and the economy ships lost per prong target (rock id), from its raid log. */
export function prongSummary(r: FieldResult): { byCount: Record<number, number>; lostByTarget: Record<string, number> } {
  const byCount: Record<number, number> = {};
  const lostByTarget: Record<string, number> = {};
  for (const raid of r.raidLog) {
    const n = Math.max(1, raid.prongs.length);
    byCount[n] = (byCount[n] ?? 0) + 1;
    for (const p of raid.prongs) lostByTarget[p.target] = (lostByTarget[p.target] ?? 0) + p.econLost;
  }
  return { byCount, lostByTarget };
}

/** The hive time of a won run, in ticks, else null. */
const winTick = (r: FieldResult | undefined): number | null => (r !== undefined && r.outcome === 'won' ? r.hiveTick : null);

/**
 * A strategy's win time against `adaptive` on the same seed, as a whole percent (+12 is 12% slower), or null when
 * either did not win. Integer math, rounded to the nearest percent.
 */
export function slowerPct(results: readonly FieldResult[], name: string, seed: number): number | null {
  const a = winTick(results.find((r) => r.strategy === 'adaptive' && r.seed === seed));
  const t = winTick(results.find((r) => r.strategy === name && r.seed === seed));
  if (a === null || t === null || a === 0) return null;
  return Math.round(((t - a) * 100) / a);
}

/**
 * The H9 report lines (DESIGN.md "Calibration targets (H9)", as the Director ruled on 2026-11-16):
 *  - splitting matters (target 4, reworded): `adaptive-concentrate` loses at least 2 more economy ships to raids than
 *    `adaptive`, or finishes at least 10% slower, on every seed;
 *  - ignoring raids costs (targets 5a and 5b): `greedy` and `undefended` against `adaptive`. Report-only for H9, so both
 *    are `reported`: the line shows each one's win time against adaptive and whether it reached +10%.
 */
export function computeH9Lines(results: readonly FieldResult[]): FieldFlag[] {
  const ad = rowsOf(results, 'adaptive');
  const out: FieldFlag[] = [];
  {
    const co = rowsOf(results, 'adaptive-concentrate');
    const rows = ad.map((a) => ({ seed: a.seed, a: lostTotal(a), c: co.find((r) => r.seed === a.seed) }));
    const pctOf = (x: { seed: number }): number | null => slowerPct(results, 'adaptive-concentrate', x.seed);
    const ok = (x: { seed: number; a: number; c: FieldResult | undefined }): boolean => {
      if (x.c === undefined) return false;
      const pct = pctOf(x);
      return lostTotal(x.c) >= x.a + 2 || (pct !== null && pct >= 10);
    };
    const pctText = (x: { seed: number }): string => {
      const pct = pctOf(x);
      return pct === null ? 'time n/a' : `${pct >= 0 ? '+' : ''}${pct}%`;
    };
    out.push({
      name: 'Splitting matters: adaptive-concentrate loses at least 2 more economy ships to raids than adaptive, or finishes at least 10% slower, on every seed',
      pass: ad.length > 0 && rows.every(ok),
      detail: ad.length === 0 || co.length === 0 ? 'no runs' : rows.map((x) => `seed ${x.seed}: adaptive lost ${x.a}, concentrate lost ${x.c === undefined ? '-' : lostTotal(x.c)}, concentrate ${pctText(x)} ${ok(x) ? 'ok' : 'MISS'}`).join('; '),
    });
  }
  {
    const half = (name: string, mayNotWin: boolean): { pass: boolean; text: string } => {
      const rs = ad.map((a) => ({ seed: a.seed, r: results.find((x) => x.strategy === name && x.seed === a.seed), pct: slowerPct(results, name, a.seed), adWon: a.outcome === 'won' }));
      const ok = (x: { r: FieldResult | undefined; pct: number | null; adWon: boolean }): boolean => x.r !== undefined && (x.pct !== null ? x.pct >= 10 : mayNotWin && x.adWon && x.r.outcome !== 'won');
      return {
        pass: rs.length > 0 && rs.every(ok),
        text: `${name}: ${rs.map((x) => `seed ${x.seed} ${x.r === undefined ? 'no run' : x.pct !== null ? `${x.pct >= 0 ? '+' : ''}${x.pct}%` : x.r.outcome === 'won' ? 'n/a' : x.r.outcome} ${ok(x) ? '(at least 10% slower)' : '(under 10% slower)'}`).join(', ')}`,
      };
    };
    const g = half('greedy', false);
    const u = half('undefended', true);
    out.push({
      name: 'Ignoring raids costs (5a, reported finding): greedy against adaptive',
      pass: ad.length > 0 && g.pass,
      detail: ad.length === 0 ? 'no runs' : g.text,
      reported: true,
    });
    out.push({
      name: 'Ignoring raids costs (5b, report-only rule finding): undefended against adaptive (undefended may fail to win)',
      pass: ad.length > 0 && u.pass,
      detail: ad.length === 0 ? 'no runs' : u.text,
      reported: true,
    });
  }
  return out;
}
