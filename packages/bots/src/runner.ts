import { performance } from 'node:perf_hooks';
import {
  RAW_RESOURCES,
  campaignSummary,
  campaignWorld,
  createWorld,
  isWon,
  runSummary,
  step,
  throughputPerMin,
  worldHash,
  type CampaignStart,
  type Input,
  type ResourceTriple,
  type SimData,
  type World,
} from '@factory4x/sim';
import { decideArea, decideOverworld, type CampaignStrategy } from './strategies.ts';

/** won = the probe core was bought; timeout = the campaign cap ran out; softlock = nothing left to do or a second visit timeout. */
export type Outcome = 'won' | 'timeout' | 'softlock' | 'crash';

/** The whole campaign is capped at this many game minutes of play (DESIGN.md H4 "Bots: campaign strategies"). */
export const CAMPAIGN_CAP_MIN = 120;
/** An area's opening is over once its route deliveries reach this many ore per minute (report definition, not a game tunable). */
export const OPENING_ORE_PER_MIN = 40;

/** One landing: from enterArea to the heart capture (reclaimed) or a withdraw. */
export interface Visit {
  area: string;
  /** World tick of the landing. */
  startTick: number;
  /** Game ticks played in the visit (landing to capture, or to the withdraw). */
  playTicks: number;
  result: 'reclaimed' | 'withdrawn';
  /** Ticks from the landing until route deliveries first reached OPENING_ORE_PER_MIN; null if never in the visit. */
  openingTicks: number | null;
  shipsBuilt: number;
  shipsLost: number;
}

export interface ResearchBuy {
  item: string;
  level: number;
  /** World tick, and game ticks of play so far. */
  tick: number;
  playTicks: number;
}

export interface CampaignResult {
  strategy: string;
  seed: number;
  outcome: Outcome;
  /** Game ticks of play (held-area visits, withdrawals included) when the run ended: the time to the core if won. */
  playTicks: number;
  /** World ticks stepped, overworld included. */
  ticks: number;
  /** The visits in order. */
  visits: Visit[];
  /** Area ids in reclaim order. */
  reclaimOrder: string[];
  /** Area ids still held at the end (skipped). */
  skipped: string[];
  entries: Record<string, number>;
  withdrawals: Record<string, number>;
  research: ResearchBuy[];
  shipsBuilt: number;
  shipsLost: number;
  hauled: ResourceTriple;
  shipped: ResourceTriple;
  /** Shipped units over hauled + shipped units, in percent (integer); 0 if neither. */
  shippedSharePct: number;
  /** In-area step times (the overworld is paused and costs nothing). */
  tickMsP50: number;
  tickMsP95: number;
  finalHash: string;
  error?: string;
}

export interface RunOptions {
  /** Start from campaignWorld(seed, data, start) instead of createWorld (the flag 4 probes). */
  start?: Readonly<CampaignStart>;
  /** A visit longer than this is withdrawn; a second timeout in the same area is a softlock (30 game minutes). */
  visitCapTicks: number;
  /** Stop with 'timeout' after this many play ticks (120 game minutes). */
  campaignCapTicks: number;
  /** Stop (outcome 'won' is not set; the caller reads the visits) after this many reclaims in this run. */
  stopAfterReclaims?: number;
  /** H5: set `fleet.cap` to this with a setTunable on the first step (undefined: the data's default). */
  fleetCap?: number;
}

/**
 * h5-sim: the H4 strategies play H4's rules, so they run with fleet.cap 0 (no fleet limit; DESIGN.md H5
 * "The A/B switch"). h5-bots replaces them with the H5 composer strategies, which play the limit.
 */
export const H4_FLEET_CAP = 0;

export function defaultRunOptions(data: SimData, visitCapTicks: number): RunOptions {
  return { visitCapTicks, campaignCapTicks: CAMPAIGN_CAP_MIN * 60 * data.tickRate, fleetCap: H4_FLEET_CAP };
}

function percentile(sorted: Float64Array, p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

/** Game ticks played so far: every area's held play ticks plus the visit in progress (the campaignSummary definition). */
function playTicksNow(world: Readonly<World>): number {
  const camp = world.campaign;
  let total = 0;
  for (const r of camp.areas) total += r.playTicks;
  if (camp.active !== null && camp.areas[camp.active]!.reclaimedTick === null) total += world.tick - camp.areaStartTick;
  return total;
}

const sumTriple = (t: ResourceTriple): number => RAW_RESOURCES.reduce((n, r) => n + t[r], 0);

/**
 * Play a campaign. On the overworld the strategy buys research and lands; in an area `decideArea` plays and the
 * runner leaves as soon as the heart falls. A visit past `visitCapTicks` is withdrawn; a second such timeout on
 * one area, or an overworld with nothing to buy and nothing open, is a softlock.
 */
export function runCampaign(strategy: CampaignStrategy, seed: number, data: SimData, opts: RunOptions): CampaignResult {
  const world = opts.start ? campaignWorld(seed, data, opts.start) : createWorld(seed, data);
  const camp = world.campaign;
  const times: number[] = [];
  const visits: Visit[] = [];
  const research: ResearchBuy[] = [];
  const timeouts = new Map<number, number>();
  let visit: { area: number; startTick: number; openingTicks: number | null } | null = null;
  let loggedResearch = camp.researchLog.length;
  let reclaims = 0;
  let outcome: Outcome = 'timeout';
  let error: string | undefined;
  let firstInputs: Input[] = opts.fleetCap === undefined ? [] : [{ type: 'setTunable', key: 'fleet.cap', value: opts.fleetCap }];

  const finishVisit = (result: 'reclaimed' | 'withdrawn'): void => {
    if (visit === null) return;
    const rec = camp.areas[visit.area]!;
    const s = runSummary(world);
    visits.push({
      area: data.map.areas[visit.area]!.id,
      startTick: visit.startTick,
      playTicks: result === 'reclaimed' ? (rec.reclaimPlayTicks ?? world.tick - visit.startTick) : world.tick - visit.startTick,
      result,
      openingTicks: visit.openingTicks,
      shipsBuilt: s.shipsBuilt,
      shipsLost: s.shipsLost,
    });
    if (result === 'reclaimed') reclaims++;
    visit = null;
  };

  try {
    for (;;) {
      if (isWon(world)) {
        outcome = 'won';
        break;
      }
      if (opts.stopAfterReclaims !== undefined && reclaims >= opts.stopAfterReclaims) break;
      if (playTicksNow(world) >= opts.campaignCapTicks) break;
      let inputs: Input[];
      const inArea = camp.active !== null;
      if (inArea) {
        if (visit === null) visit = { area: camp.active!, startTick: camp.areaStartTick, openingTicks: null };
        if (world.capturedTick !== null) {
          finishVisit('reclaimed');
          inputs = [{ type: 'leaveArea' }];
        } else if (world.tick - camp.areaStartTick >= opts.visitCapTicks) {
          const a = camp.active!;
          finishVisit('withdrawn');
          timeouts.set(a, (timeouts.get(a) ?? 0) + 1);
          if ((timeouts.get(a) ?? 0) >= 2) {
            outcome = 'softlock';
            break;
          }
          inputs = [{ type: 'leaveArea' }];
        } else {
          inputs = decideArea(world);
        }
      } else {
        const input = decideOverworld(world, data, strategy);
        if (input === null) {
          outcome = 'softlock';
          break;
        }
        inputs = [input];
      }
      if (firstInputs.length > 0) {
        inputs = [...firstInputs, ...inputs];
        firstInputs = [];
      }
      const t0 = performance.now();
      step(world, data, inputs);
      if (inArea) times.push(performance.now() - t0);
      if (camp.active !== null && visit !== null && visit.openingTicks === null && throughputPerMin(world) >= OPENING_ORE_PER_MIN) {
        visit.openingTicks = world.tick - camp.areaStartTick;
      }
      while (loggedResearch < camp.researchLog.length) {
        const e = camp.researchLog[loggedResearch++]!;
        research.push({ item: e.item, level: e.level, tick: e.tick, playTicks: playTicksNow(world) });
      }
    }
  } catch (e) {
    outcome = 'crash';
    error = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
  }

  const sorted = Float64Array.from(times).sort();
  const sum = campaignSummary(world, data);
  const hauledUnits = sumTriple(sum.hauled);
  const shippedUnits = sumTriple(sum.shipped);
  const entries: Record<string, number> = {};
  const withdrawals: Record<string, number> = {};
  const skipped: string[] = [];
  for (const a of sum.areas) {
    entries[a.id] = a.entries;
    withdrawals[a.id] = a.withdrawals;
    if (a.reclaimedTick === null) skipped.push(a.id);
  }
  const result: CampaignResult = {
    strategy: strategy.name,
    seed,
    outcome,
    playTicks: playTicksNow(world),
    ticks: world.tick,
    visits,
    reclaimOrder: sum.reclaimOrder.map((r) => r.id),
    skipped,
    entries,
    withdrawals,
    research,
    shipsBuilt: sum.shipsBuilt,
    shipsLost: sum.shipsLost,
    hauled: sum.hauled,
    shipped: sum.shipped,
    shippedSharePct: hauledUnits + shippedUnits === 0 ? 0 : Math.floor((shippedUnits * 100) / (hauledUnits + shippedUnits)),
    tickMsP50: percentile(sorted, 50),
    tickMsP95: percentile(sorted, 95),
    finalHash: worldHash(world),
  };
  if (error !== undefined) result.error = error;
  return result;
}

/** Play a strategy over seeds 1..seeds. */
export function runSeeds(strategy: CampaignStrategy, seeds: number, data: SimData, visitCapTicks: number): CampaignResult[] {
  const out: CampaignResult[] = [];
  for (let seed = 1; seed <= seeds; seed++) out.push(runCampaign(strategy, seed, data, defaultRunOptions(data, visitCapTicks)));
  return out;
}

/** Game seconds as m:ss. */
export const mmss = (sec: number | null): string => (sec === null ? 'never' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
/** Ticks as m:ss. */
export const tickMmss = (ticks: number | null, tickRate: number): string => (ticks === null ? 'never' : mmss(Math.floor(ticks / tickRate)));
/** True when a and b differ by at most pct percent of the smaller (integers). */
const within = (a: number, b: number, pct: number): boolean => Math.abs(a - b) * 100 <= pct * Math.min(a, b);

/** The visit that reclaimed `area`, or null. */
export function reclaimVisit(r: Pick<CampaignResult, 'visits'>, area: string): Visit | null {
  for (const v of r.visits) if (v.area === area && v.result === 'reclaimed') return v;
  return null;
}

/** Opening time (ticks) of the visit that reclaimed `area`; a visit that never reached the rate counts as its whole length. */
function openingOf(r: CampaignResult, area: string): number | null {
  const v = reclaimVisit(r, area);
  return v === null ? null : (v.openingTicks ?? v.playTicks);
}

/** The first tier-1 area an area order reclaims. */
function firstLight(r: CampaignResult): string | null {
  return r.reclaimOrder.find((id) => id === 'shelf' || id === 'shoal') ?? null;
}

/** The flag 4 probe runs: ticks the greedy engine needed to reclaim the area, null if it didn't. */
export interface Flag4Probes {
  veilFlak: number | null;
  veilLancer: number | null;
  gardenLancer: number | null;
  gardenFlak: number | null;
}

/**
 * Flag 4's four games (seed 1): from a constructed campaign with Landfall, Frost Shelf and Glass Shoal reclaimed
 * and opening 1, extraction 1 bought, plus one design, the in-area engine reclaims Spore Veil or Thorn Garden.
 */
export function runFlag4Probes(data: SimData, visitCapTicks: number, seed = 1): Flag4Probes {
  const probe = (area: string, design: 'lancer' | 'flak'): number | null => {
    const strategy: CampaignStrategy = { name: `probe-${area}-${design}`, description: '', kit: 'none', route: [area] };
    const r = runCampaign(strategy, seed, data, {
      start: { reclaimed: ['landfall', 'shelf', 'shoal'], research: { opening: 1, extract: 1, [design]: 1 } },
      visitCapTicks,
      campaignCapTicks: visitCapTicks,
      stopAfterReclaims: 1,
      fleetCap: H4_FLEET_CAP,
    });
    return reclaimVisit(r, area)?.playTicks ?? null;
  };
  return {
    veilFlak: probe('veil', 'flak'),
    veilLancer: probe('veil', 'lancer'),
    gardenLancer: probe('garden', 'lancer'),
    gardenFlak: probe('garden', 'flak'),
  };
}

/** One flag line: `pass` is a report marker, never a gate. */
export interface H4Flag {
  name: string;
  pass: boolean;
  detail: string;
}

/** Spec target windows for an area's reclaiming visit, in game seconds (DESIGN.md H4 flag 2). */
export const AREA_TIME_TARGETS: Readonly<Record<string, readonly [number, number]>> = {
  landfall: [0, 60],
  shelf: [4 * 60, 9 * 60],
  shoal: [4 * 60, 9 * 60],
  veil: [6 * 60, 13 * 60],
  garden: [6 * 60, 13 * 60],
  deep: [8 * 60, 16 * 60],
};
/** Flag 2 window for the best strategy's full run, in game minutes. */
export const RUN_MIN_MIN = 45;
export const RUN_MAX_MIN = 75;

/** Mean reclaiming-visit seconds per area over the results that reclaimed it (integer), or null. */
export function meanAreaSeconds(results: readonly CampaignResult[], area: string, tickRate: number): number | null {
  const xs: number[] = [];
  for (const r of results) {
    const v = reclaimVisit(r, area);
    if (v !== null) xs.push(v.playTicks);
  }
  return xs.length === 0 ? null : Math.floor(xs.reduce((a, b) => a + b, 0) / xs.length / tickRate);
}

/** Results of one seed. */
const ofSeed = (results: readonly CampaignResult[], seed: number): CampaignResult[] => results.filter((r) => r.seed === seed);
const wonOnly = (rs: readonly CampaignResult[]): CampaignResult[] => rs.filter((r) => r.outcome === 'won');
const best = (rs: readonly CampaignResult[]): CampaignResult | null => wonOnly(rs).reduce<CampaignResult | null>((b, r) => (b === null || r.playTicks < b.playTicks ? r : b), null);

/**
 * The seven H4 flags (DESIGN.md H4 "Bots: campaign strategies") as report lines. `probes` is flag 4's four runs
 * (null if not run); `seeds` how many seeds were played; the determinism result comes from the CLI.
 */
export function computeH4Flags(
  results: readonly CampaignResult[],
  probes: Flag4Probes | null,
  data: Pick<SimData, 'tickRate'>,
  seeds: number,
  determinismOk: boolean,
  determinismDetail = '',
): H4Flag[] {
  const tr = data.tickRate;
  const sec = (ticks: number | null): number | null => (ticks === null ? null : Math.floor(ticks / tr));
  const mins = (ticks: number | null): string => (ticks === null ? 'never' : (ticks / tr / 60).toFixed(1));
  const seedList = Array.from({ length: seeds }, (_, i) => i + 1);
  const flags: H4Flag[] = [];

  // 1. No softlock.
  const f1 = `No softlock: every strategy buys the probe core on every seed within ${CAMPAIGN_CAP_MIN} game minutes of play`;
  const bad = results.filter((r) => r.outcome !== 'won' || r.playTicks > CAMPAIGN_CAP_MIN * 60 * tr);
  flags.push({
    name: f1,
    pass: results.length > 0 && bad.length === 0,
    detail: bad.length === 0 ? `all ${results.length} runs bought the core` : `not won: ${bad.map((r) => `${r.strategy}/${r.seed} ${r.outcome}`).join(', ')}`,
  });

  // 2. Run length and area times.
  const f2 = `Run length: the best strategy's full run is ${RUN_MIN_MIN}-${RUN_MAX_MIN} game minutes on every seed, and mean area times are inside their windows`;
  {
    const parts: string[] = [];
    let okRun = true;
    for (const s of seedList) {
      const b = best(ofSeed(results, s));
      if (b === null || b.playTicks < RUN_MIN_MIN * 60 * tr || b.playTicks > RUN_MAX_MIN * 60 * tr) okRun = false;
      parts.push(`seed ${s} best ${b === null ? 'none' : `${b.strategy} ${mins(b.playTicks)} min`}`);
    }
    const areaParts: string[] = [];
    let okAreas = true;
    for (const [id, [lo, hi]] of Object.entries(AREA_TIME_TARGETS)) {
      const m = meanAreaSeconds(results, id, tr);
      const ok = m !== null && m >= lo && m <= hi;
      if (!ok) okAreas = false;
      areaParts.push(`${id} ${m === null ? 'never' : mmss(m)} (${mmss(lo)}-${mmss(hi)}${ok ? '' : ' MISS'})`);
    }
    flags.push({ name: f2, pass: okRun && okAreas, detail: `${parts.join('; ')}; run ${okRun ? 'inside' : 'OUTSIDE'} the window; mean area times ${areaParts.join(', ')}` });
  }

  // 3. Two viable sides.
  const f3 = 'Two viable sides: ice-line and crystal-line finish within 15% of each other on at least 2 of 3 seeds';
  {
    let close = 0;
    const parts: string[] = [];
    for (const s of seedList) {
      const i = ofSeed(results, s).find((r) => r.strategy === 'ice-line');
      const c = ofSeed(results, s).find((r) => r.strategy === 'crystal-line');
      if (!i || !c || i.outcome !== 'won' || c.outcome !== 'won') {
        parts.push(`seed ${s}: ice ${i?.outcome ?? 'missing'}, crystal ${c?.outcome ?? 'missing'}`);
        continue;
      }
      const ok = within(i.playTicks, c.playTicks, 15);
      if (ok) close++;
      const gap = Math.round((Math.abs(i.playTicks - c.playTicks) * 100) / Math.min(i.playTicks, c.playTicks));
      parts.push(`seed ${s}: ice ${mins(i.playTicks)}, crystal ${mins(c.playTicks)}, gap ${gap}% (${ok ? 'within' : 'outside'})`);
    }
    flags.push({ name: f3, pass: close >= 2, detail: `${close} of ${seeds} within 15%; ${parts.join('; ')}` });
  }

  // 4. The design decides the cheap medium.
  const f4 = 'The design decides the cheap medium: Spore Veil is at least 20% faster with Flak only than Lancer only, Thorn Garden at least 20% faster with Lancer only than Flak only (seed 1, four probe runs)';
  if (probes === null) flags.push({ name: f4, pass: false, detail: 'probe runs not performed' });
  else {
    // fast is at least 20% faster than slow: fast * 100 <= slow * 80 (a slow run that never finished is infinitely slow).
    const faster = (fast: number | null, slow: number | null): boolean => fast !== null && (slow === null || fast * 100 <= slow * 80);
    const veil = faster(probes.veilFlak, probes.veilLancer);
    const garden = faster(probes.gardenLancer, probes.gardenFlak);
    const pct = (fast: number | null, slow: number | null): string => (fast === null || slow === null ? 'n/a' : `${Math.round(((slow - fast) * 100) / slow)}% faster`);
    flags.push({
      name: f4,
      pass: veil && garden,
      detail: `Veil: flak ${mmss(sec(probes.veilFlak))}, lancer ${mmss(sec(probes.veilLancer))} (flak ${pct(probes.veilFlak, probes.veilLancer)}, ${veil ? 'met' : 'missed'}); Garden: lancer ${mmss(sec(probes.gardenLancer))}, flak ${mmss(sec(probes.gardenFlak))} (lancer ${pct(probes.gardenLancer, probes.gardenFlak)}, ${garden ? 'met' : 'missed'})`,
    });
  }

  // 5. Research matters, and openings shrink.
  const f5 = 'Research matters: no-research takes at least 25% longer than the best strategy on every seed, and every researching strategy opens its last area in at most 60% of the time of its first light area';
  {
    const parts: string[] = [];
    let okSlow = true;
    for (const s of seedList) {
      const rs = ofSeed(results, s);
      const nr = rs.find((r) => r.strategy === 'no-research');
      const b = best(rs.filter((r) => r.strategy !== 'no-research'));
      if (!nr || nr.outcome !== 'won' || !b || nr.playTicks * 100 < b.playTicks * 125) okSlow = false;
      const gap = nr && b ? Math.round(((nr.playTicks - b.playTicks) * 100) / b.playTicks) : null;
      parts.push(`seed ${s}: no-research ${mins(nr?.playTicks ?? null)} vs best ${b ? `${b.strategy} ${mins(b.playTicks)}` : 'none'} min (${gap === null ? 'n/a' : `+${gap}%`})`);
    }
    const openParts: string[] = [];
    let okOpen = true;
    for (const r of results.filter((x) => x.strategy !== 'no-research')) {
      const light = firstLight(r);
      const last = r.reclaimOrder.at(-1) ?? null;
      const a = light === null ? null : openingOf(r, light);
      const b = last === null ? null : openingOf(r, last);
      const lastVisit = last === null ? null : reclaimVisit(r, last);
      // A last-area visit that never reached the rate has no opening time to compare.
      const ok = a !== null && b !== null && lastVisit?.openingTicks !== null && b * 100 <= a * 60;
      if (!ok) okOpen = false;
      openParts.push(`${r.strategy}/${r.seed} ${last ?? '-'} ${tickMmss(lastVisit?.openingTicks ?? null, tr)} vs ${light ?? '-'} ${tickMmss(a, tr)}${ok ? '' : ' MISS'}`);
    }
    flags.push({ name: f5, pass: okSlow && okOpen, detail: `${parts.join('; ')}; openings (last area vs first light area): ${openParts.join(', ')}` });
  }

  // 6. Order varies.
  const f6 = 'Order varies: at least two different area orders finish within 15% of the best full-run time on every seed';
  {
    const parts: string[] = [];
    let all = true;
    for (const s of seedList) {
      const rs = ofSeed(results, s);
      const b = best(rs);
      const orders = new Set<string>();
      if (b !== null) for (const r of wonOnly(rs)) if (within(r.playTicks, b.playTicks, 15)) orders.add(r.reclaimOrder.join('>'));
      if (orders.size < 2) all = false;
      parts.push(`seed ${s}: ${orders.size} order${orders.size === 1 ? '' : 's'}`);
    }
    flags.push({ name: f6, pass: all && seeds > 0, detail: parts.join('; ') });
  }

  flags.push({ name: 'Determinism and the reference replay pass', pass: determinismOk, detail: determinismDetail });
  return flags;
}
