import { performance } from 'node:perf_hooks';
import {
  campaignWorld,
  lastBattle,
  runSummary,
  step,
  throughputPerMin,
  worldHash,
  type BattleOutcome,
  type CampaignStart,
  type RawResource,
  type RunSummary,
  type ShipTypeCounts,
  type SimData,
} from '@factory4x/sim';
import type { Strategy } from './strategies.ts';

/** won = the heart was captured; timeout = still uncaptured at the tick cap. */
export type Outcome = 'won' | 'timeout' | 'softlock' | 'crash';

/** Game minutes at which throughput is sampled (the spec's 2, 5, 10, 15, 20, plus 12 for the "still rising at 10" check). */
export const SAMPLE_MINUTES = [2, 5, 10, 12, 15, 20] as const;

export interface GameResult {
  strategy: string;
  seed: number;
  outcome: Outcome;
  ticks: number;
  /** Game seconds to capture; null if not captured within the run. */
  captureSec: number | null;
  /** Game seconds when the first ship was built; null if none. */
  firstShipSec: number | null;
  /** throughputPerMin at each sample minute, keyed by minute; null if the run ended first. */
  throughputAtMin: Record<string, number | null>;
  /** Peak ore/min over the whole run. */
  peakPerMin: number;
  /** Ships built, ships lost and ore spent, as of capture (end of the run if never captured). */
  shipsBuilt: number;
  shipsLost: number;
  oreSpentShips: number;
  oreSpentEconomy: number;
  /** Waves sent and repelled as of capture (end of the run if never captured). */
  wavesSent: number;
  wavesRepelled: number;
  /** Outcome of the first wave's battle, or null if no battle finished. */
  firstWaveOutcome: BattleOutcome | null;
  /** The layout (DESIGN.md H3): id ('frost', 'glass', 'twin') and name. */
  variantId: string;
  variantName: string;
  /** Ships lost by type, as of capture (end of the run if never captured). */
  shipsLostByType: ShipTypeCounts;
  /** Capture order up to the heart, with game seconds (p1, p4, root, heart). */
  captureOrder: { id: string; prize: RawResource | null; sec: number }[];
  /** Game seconds each resource was first delivered, or null. */
  firstDeliveredSec: Record<RawResource, number | null>;
  /** Game seconds when the Root was cut; null if it was left standing. */
  rootCutSec: number | null;
  /** Ships lost at the Root, heart guards withered by the cut, and waves sent at the Root and the heart (as of capture). */
  rootShipsLost: number;
  guardsWithered: number;
  rootWavesSent: number;
  heartWavesSent: number;
  /** Whole-run totals (all ticks, including the post-capture build-out up to the tick cap). */
  wholeRun: { shipsBuilt: number; shipsLost: number; oreSpentShips: number; oreSpentEconomy: number };
  tickMsP50: number;
  tickMsP95: number;
  finalHash: string;
  error?: string;
}

function percentile(sorted: Float64Array, p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

/** Softlock: this many game seconds without a route delivery or a ship built, before capture. */
export const SOFTLOCK_SEC = 60 * 5;

/**
 * Interim bot gate (DESIGN.md H4, h4-sim; h4-bots replaces it with the campaign runner): every game starts
 * from a campaign with every area but The Deep reclaimed and both designs bought, landed in The Deep at
 * tick 0. That is an H3 game on the run's layout with the H4 opening (economy.startStock, no other research).
 */
export const INTERIM_DEEP_START: Readonly<CampaignStart> = Object.freeze({
  reclaimed: ['landfall', 'shelf', 'shoal', 'veil', 'garden'],
  research: { lancer: 1, flak: 1 },
  land: 'deep',
});

export function runGame(strategy: Strategy, seed: number, data: SimData, maxTicks: number): GameResult {
  const world = campaignWorld(seed, data, INTERIM_DEEP_START);
  const times = new Float64Array(maxTicks);
  let outcome: Outcome = 'timeout';
  let error: string | undefined;
  let lastProgressTick = 0;
  let lastShipsBuilt = 0;
  let prevBucketIdx = -1;
  let prevBucketVal = 0;
  let atCapture: RunSummary | null = null;
  let wavesSentAtCapture = 0;
  let repelledAtCapture = 0;
  let wavesRepelled = 0;
  let firstWaveOutcome: BattleOutcome | null = null;
  const lastBattleEnd: number[] = [];
  const throughputAtMin: Record<string, number | null> = {};
  for (const m of SAMPLE_MINUTES) throughputAtMin[String(m)] = null;
  const sampleTicks = new Map<number, number>();
  for (const m of SAMPLE_MINUTES) sampleTicks.set(m * 60 * data.tickRate, m);

  try {
    for (let i = 0; i < maxTicks; i++) {
      const inputs = strategy.decide(world);
      const t0 = performance.now();
      step(world, data, inputs);
      times[i] = performance.now() - t0;

      // Per node: world.lastBattle is the latest at any node, so a Root battle would hide a Bloom one.
      for (const g of world.guardians) {
        const lb = lastBattle(world, g.node);
        if (lb !== null && lb.endTick !== (lastBattleEnd[g.node] ?? -1)) {
          lastBattleEnd[g.node] = lb.endTick;
          if (lb.outcome === 'repelled') wavesRepelled++;
          if (firstWaveOutcome === null) firstWaveOutcome = lb.outcome;
        }
      }
      const minute = sampleTicks.get(world.tick);
      if (minute !== undefined) throughputAtMin[String(minute)] = throughputPerMin(world);

      if (atCapture === null && world.capturedTick !== null) {
        atCapture = runSummary(world);
        wavesSentAtCapture = atCapture.wavesSent;
        repelledAtCapture = wavesRepelled;
      }

      // Probe mining changes the state hash every tick, so progress is what matters:
      // ore arriving by route (the per-second delivery bucket of the tick just run grew)
      // or a ship being built. Checked every tick, so the 5 minutes are exact.
      const buckets = world.stats.deliveredBuckets;
      const idx = Math.floor((world.tick - 1) / data.tickRate) % buckets.length;
      const val = buckets[idx]!;
      if (val > (idx === prevBucketIdx ? prevBucketVal : 0)) lastProgressTick = world.tick;
      prevBucketIdx = idx;
      prevBucketVal = val;
      const built = world.stats.shipsBuilt.drone + world.stats.shipsBuilt.lancer + world.stats.shipsBuilt.flak;
      if (built !== lastShipsBuilt) {
        lastShipsBuilt = built;
        lastProgressTick = world.tick;
      }
      if (world.capturedTick === null && world.tick - lastProgressTick >= SOFTLOCK_SEC * data.tickRate) {
        outcome = 'softlock';
        break;
      }
    }
    if (outcome === 'timeout' && world.capturedTick !== null) outcome = 'won';
  } catch (e) {
    outcome = 'crash';
    error = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
  }

  const measured = times.slice(0, world.tick).sort();
  const end = runSummary(world);
  const s = atCapture ?? end;
  const result: GameResult = {
    strategy: strategy.name,
    seed,
    outcome,
    ticks: world.tick,
    captureSec: outcome === 'won' ? end.captureSec : null,
    firstShipSec: end.firstShipTick === null ? null : Math.floor(end.firstShipTick / data.tickRate),
    throughputAtMin,
    peakPerMin: end.peakPerMin,
    shipsBuilt: s.shipsBuilt,
    shipsLost: s.shipsLost,
    shipsLostByType: s.shipsLostByType,
    captureOrder: s.captures.map((c) => ({ id: c.id, prize: c.prize, sec: c.sec })),
    firstDeliveredSec: end.firstDeliveredSec,
    wavesSent: atCapture ? wavesSentAtCapture : s.wavesSent,
    wavesRepelled: atCapture ? repelledAtCapture : wavesRepelled,
    firstWaveOutcome,
    variantId: end.variantId,
    variantName: end.variantName,
    rootCutSec: end.rootCutSec,
    rootShipsLost: s.rootShipsLost,
    guardsWithered: s.guardsWithered,
    rootWavesSent: s.rootWavesSent,
    heartWavesSent: s.heartWavesSent,
    oreSpentShips: s.oreSpentShips,
    oreSpentEconomy: s.oreSpentEconomy,
    wholeRun: { shipsBuilt: end.shipsBuilt, shipsLost: end.shipsLost, oreSpentShips: end.oreSpentShips, oreSpentEconomy: end.oreSpentEconomy },
    tickMsP50: percentile(measured, 50),
    tickMsP95: percentile(measured, 95),
    finalHash: worldHash(world),
  };
  if (error !== undefined) result.error = error;
  return result;
}

/** Play a strategy over several seeds. Every seed runs its own game and gets every check. */
export function runSeeds(strategy: Strategy, seeds: number, data: SimData, maxTicks: number): GameResult[] {
  const out: GameResult[] = [];
  for (let seed = 1; seed <= seeds; seed++) out.push(runGame(strategy, seed, data, maxTicks));
  return out;
}

/** One depth-flag line: `pass` is a report marker, never a gate. */
export interface DepthFlag {
  name: string;
  pass: boolean;
  detail: string;
}

/** The layouts the H3 report compares (seeds 1-3 cover them: glass, twin, frost). */
export const VARIANT_IDS = ['frost', 'glass', 'twin'] as const;
export const H3_STRATEGIES = ['drones-only', 'ice-first', 'crystal-first', 'greedy'] as const;

/** Flag 1 window: heart capture between 15 and 45 game minutes. */
export const CAPTURE_MIN_SEC = 15 * 60;
export const CAPTURE_MAX_SEC = 45 * 60;

/** One comparison row per layout: the lowest seed that played it, per strategy. */
export interface LayoutRow {
  variantId: string;
  variantName: string;
  seed: number;
  byStrategy: Record<string, GameResult>;
}

/** Group results by layout (the lowest seed per layout), in VARIANT_IDS order. */
export function layoutRows(results: readonly GameResult[]): LayoutRow[] {
  const rows: LayoutRow[] = [];
  for (const id of VARIANT_IDS) {
    const mine = results.filter((r) => r.variantId === id);
    if (mine.length === 0) continue;
    const seed = Math.min(...mine.map((r) => r.seed));
    const byStrategy: Record<string, GameResult> = {};
    for (const r of mine) if (r.seed === seed) byStrategy[r.strategy] = r;
    rows.push({ variantId: id, variantName: mine[0]!.variantName, seed, byStrategy });
  }
  return rows;
}

/** Game seconds as m:ss. */
export const mmss = (sec: number | null): string => (sec === null ? 'never' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
/** True when a and b differ by at most pct percent of the smaller (integers). */
const within = (a: number, b: number, pct: number): boolean => Math.abs(a - b) * 100 <= pct * Math.min(a, b);

/**
 * The six H3 depth flags (DESIGN.md H3 "Bot checks") as report lines. Flags
 * 1-5 read one game per layout and strategy (the lowest seed that plays the
 * layout); flag 6 takes the determinism result from the CLI. Ships lost and
 * capture times are as of the heart capture.
 */
export function computeDepthFlags(results: readonly GameResult[], determinismOk: boolean, determinismDetail = ''): DepthFlag[] {
  const rows = layoutRows(results);
  const complete = rows.length === VARIANT_IDS.length && rows.every((r) => H3_STRATEGIES.every((s) => r.byStrategy[s] !== undefined));
  const need = (name: string): DepthFlag => ({ name, pass: false, detail: 'needs all four strategies on all three layouts (run with --seeds 3 or more)' });
  const flags: DepthFlag[] = [];

  const f1 = 'Every strategy captures the heart in every layout within 15-45 game minutes, no softlock';
  if (!complete) flags.push(need(f1));
  else {
    const bad: string[] = [];
    for (const row of rows) {
      for (const s of H3_STRATEGIES) {
        const r = row.byStrategy[s]!;
        if (r.outcome === 'softlock' || r.outcome === 'crash') bad.push(`${s}/${row.variantId} ${r.outcome}`);
        else if (r.captureSec === null) bad.push(`${s}/${row.variantId} never captured`);
        else if (r.captureSec < CAPTURE_MIN_SEC || r.captureSec > CAPTURE_MAX_SEC) bad.push(`${s}/${row.variantId} ${mmss(r.captureSec)}`);
      }
    }
    flags.push({ name: f1, pass: bad.length === 0, detail: bad.length === 0 ? 'all 12 games inside the window' : `outside: ${bad.join(', ')}` });
  }

  const f2 = 'Counters matter: in every layout drones-only loses at least 40% more ships than the best strategy, or captures at least 20% later';
  if (!complete) flags.push(need(f2));
  else {
    const parts: string[] = [];
    let all = true;
    for (const row of rows) {
      const d = row.byStrategy['drones-only']!;
      const others = H3_STRATEGIES.filter((s) => s !== 'drones-only').map((s) => row.byStrategy[s]!);
      const bestLost = Math.min(...others.map((r) => r.shipsLost));
      const caps = others.map((r) => r.captureSec).filter((v): v is number => v !== null);
      const bestCap = caps.length ? Math.min(...caps) : null;
      const moreLost = d.shipsLost > bestLost && d.shipsLost * 100 >= bestLost * 140;
      const later = d.captureSec !== null && bestCap !== null && d.captureSec * 100 >= bestCap * 120;
      if (!(moreLost || later)) all = false;
      parts.push(`${row.variantId}: lost ${d.shipsLost} vs best ${bestLost} (${moreLost ? 'yes' : 'no'}), ${mmss(d.captureSec)} vs best ${mmss(bestCap)} (${later ? 'yes' : 'no'})`);
    }
    flags.push({ name: f2, pass: all, detail: parts.join('; ') });
  }

  const f3 = 'Two viable first doors: in at least 2 of 3 layouts ice-first and crystal-first capture the heart within 15% of each other';
  const f4 = 'No fixed best opening: the faster of ice-first and crystal-first is not the same in all three layouts';
  if (!complete) {
    flags.push(need(f3), need(f4));
  } else {
    let close = 0;
    const parts: string[] = [];
    const winners: string[] = [];
    for (const row of rows) {
      const i = row.byStrategy['ice-first']!.captureSec;
      const c = row.byStrategy['crystal-first']!.captureSec;
      if (i === null || c === null) {
        parts.push(`${row.variantId}: ice ${mmss(i)}, crystal ${mmss(c)}`);
        winners.push(i === null && c === null ? 'none' : i === null ? 'crystal' : 'ice');
        continue;
      }
      const ok = within(i, c, 15);
      if (ok) close++;
      const gap = i === c ? 0 : Math.round((Math.abs(i - c) * 100) / Math.min(i, c));
      parts.push(`${row.variantId}: ice ${mmss(i)}, crystal ${mmss(c)}, gap ${gap}% (${ok ? 'within' : 'outside'})`);
      winners.push(i === c ? 'tie' : i < c ? 'ice' : 'crystal');
    }
    flags.push({ name: f3, pass: close >= 2, detail: `${close} of 3 within 15%; ${parts.join('; ')}` });
    flags.push({ name: f4, pass: new Set(winners).size > 1, detail: `faster door: ${rows.map((r, k) => `${r.variantId} ${winners[k]}`).join(', ')}` });
  }

  const f5 = 'Order varies: the greedy capture order is different in each layout';
  if (!complete) flags.push(need(f5));
  else {
    const orders = rows.map((r) => r.byStrategy['greedy']!.captureOrder.map((c) => c.id).join(' > '));
    flags.push({ name: f5, pass: new Set(orders).size === orders.length, detail: rows.map((r, k) => `${r.variantId}: ${orders[k]}`).join('; ') });
  }

  flags.push({ name: 'Determinism and the reference replay pass', pass: determinismOk, detail: determinismDetail });
  return flags;
}
