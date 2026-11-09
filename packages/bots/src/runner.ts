import { performance } from 'node:perf_hooks';
import {
  RAW_RESOURCES,
  campaignSummary,
  campaignWorld,
  createWorld,
  isWon,
  heartIndex,
  rootIndex,
  runSummary,
  step,
  throughputPerMin,
  worldHash,
  type CampaignStart,
  type Input,
  type ResourceTriple,
  type ShipTypeCounts,
  type SimData,
  type World,
} from '@factory4x/sim';
import { decideArea, decideComposer, decideOverworld, closedKey, WINNING_STRATEGIES, type CampaignStrategy } from './strategies.ts';
import { closedAt, fitsAt, singleClosedAt, singleFitsAt, type HeartProbe, type ProbeLimits } from './waves.ts';

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
  /** Withdrawn at once because nothing passed the attack test at the limit (a closed area), not a visit timeout. */
  closed: boolean;
  /** The landing was forced: every open area was recorded closed. */
  forced: boolean;
  /** Ticks from the landing until route deliveries first reached OPENING_ORE_PER_MIN; null if never in the visit. */
  openingTicks: number | null;
  shipsBuilt: number;
  shipsLost: number;
  shipsRecycled: number;
  /** The Root was cut before the heart fell (reclaimed visits): null when the area has no Root. */
  rootCutBeforeHeart: boolean | null;
  /** The ships that fought the capturing battle at the heart, by type (reclaimed visits), else null. */
  wave: ShipTypeCounts | null;
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
  shipsRecycled: number;
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
  /** Set `fleet.cap` to this with a setTunable on the first step, overriding the strategy's own (undefined: the strategy's, else the data's default). */
  fleetCap?: number;
}

export function defaultRunOptions(data: SimData, visitCapTicks: number): RunOptions {
  return { visitCapTicks, campaignCapTicks: CAMPAIGN_CAP_MIN * 60 * data.tickRate };
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
  const closedRecords = new Map<number, string>();
  let visit: { area: number; startTick: number; openingTicks: number | null; forced: boolean } | null = null;
  let nextForced = false;
  let loggedResearch = camp.researchLog.length;
  let reclaims = 0;
  let outcome: Outcome = 'timeout';
  let error: string | undefined;
  const cap0 = opts.fleetCap ?? strategy.fleetCap;
  let firstInputs: Input[] = cap0 === undefined ? [] : [{ type: 'setTunable', key: 'fleet.cap', value: cap0 }];

  const finishVisit = (result: 'reclaimed' | 'withdrawn', closed = false): void => {
    if (visit === null) return;
    const rec = camp.areas[visit.area]!;
    const s = runSummary(world);
    visits.push({
      area: data.map.areas[visit.area]!.id,
      startTick: visit.startTick,
      playTicks: result === 'reclaimed' ? (rec.reclaimPlayTicks ?? world.tick - visit.startTick) : world.tick - visit.startTick,
      result,
      closed,
      forced: visit.forced,
      openingTicks: visit.openingTicks,
      shipsBuilt: s.shipsBuilt,
      shipsLost: s.shipsLost,
      shipsRecycled: s.shipsRecycled,
      rootCutBeforeHeart: result === 'reclaimed' && rootIndex(world) >= 0 ? s.rootCutTick !== null : null,
      wave: result === 'reclaimed' && world.lastBattle !== null && world.lastBattle.node === heartIndex(world) ? { ...world.lastBattle.engagedByType } : null,
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
        if (visit === null) visit = { area: camp.active!, startTick: camp.areaStartTick, openingTicks: null, forced: nextForced };
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
          if (strategy.engine === 'h3') inputs = decideArea(world);
          else {
            const d = decideComposer(world, data, { dronesOnly: strategy.dronesOnly === true, forced: visit.forced });
            if (d.closed) {
              const a = camp.active!;
              finishVisit('withdrawn', true);
              closedRecords.set(a, closedKey(world, data));
              inputs = [{ type: 'leaveArea' }];
            } else inputs = d.inputs;
          }
        }
      } else {
        const dec = decideOverworld(world, data, strategy, closedRecords);
        const input = dec.input;
        nextForced = dec.forced;
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
    shipsRecycled: sum.shipsRecycled,
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

/** The visit that reclaimed `area`, or null. */
export function reclaimVisit(r: Pick<CampaignResult, 'visits'>, area: string): Visit | null {
  for (const v of r.visits) if (v.area === area && v.result === 'reclaimed') return v;
  return null;
}

/** One flag line: `pass` is a report marker, never a gate. */
export interface H5Flag {
  name: string;
  pass: boolean;
  detail: string;
}

/** What the flags need besides the runs and the probe: tick rate, the tier of each area id, the probe's limits. */
export interface FlagContext {
  tickRate: number;
  tiers: Readonly<Record<string, number>>;
  limits: ProbeLimits;
  seeds: number;
}

/** The strategies flag 1 covers (the ones meant to win). */
const WINNERS = WINNING_STRATEGIES;
const GAP_PP = 30;

/** Lancer share of a probe row's best mix, in whole percent (integer), or null without a mix. */
export function lancerSharePct(row: Pick<HeartProbe, 'mix' | 'mixFleet'>): number | null {
  if (row.mix === null || row.mixFleet === null || row.mix === 0) return null;
  return Math.floor((row.mixFleet.lancer * 100) / row.mix);
}

/**
 * The seven H5 flags (DESIGN.md H5 "Bots: strategies and the probe") as report lines. Each measures what can or
 * can't be done at a limit, never a time gap. `probe` is the minimum-wave probe (null if not run).
 */
export function computeH5Flags(
  results: readonly CampaignResult[],
  probe: readonly HeartProbe[] | null,
  ctx: FlagContext,
  determinismOk: boolean,
  determinismDetail = '',
): H5Flag[] {
  const { limits: L, tiers, tickRate: tr } = ctx;
  const seedList = Array.from({ length: ctx.seeds }, (_, i) => i + 1);
  const flags: H5Flag[] = [];
  const NO_PROBE = 'probe not run';
  const rowsOf = (tier: number, state: 'fed' | 'starved'): HeartProbe[] => (probe ?? []).filter((r) => r.tier === tier && r.state === state);
  const label = (r: HeartProbe): string => `${r.area}${r.layout !== null ? `/${r.layout}` : ''} ${r.state}`;
  const n = (v: number | null): string => (v === null ? '>80' : String(v));
  /** Pass if `rows` is non-empty and every row satisfies `ok`; the detail lists each. */
  const every = (rows: HeartProbe[], ok: (r: HeartProbe) => boolean, show: (r: HeartProbe) => string): { pass: boolean; detail: string } => ({
    pass: rows.length > 0 && rows.every(ok),
    detail: rows.length === 0 ? 'no rows' : rows.map((r) => `${label(r)} ${show(r)} ${ok(r) ? 'ok' : 'MISS'}`).join('; '),
  });

  // 1. No softlock.
  {
    const rs = results.filter((r) => WINNERS.includes(r.strategy));
    const bad = rs.filter((r) => r.outcome !== 'won' || r.playTicks > CAMPAIGN_CAP_MIN * 60 * tr);
    flags.push({
      name: `No softlock: ${WINNERS.join(', ')} buy the probe core on every seed within ${CAMPAIGN_CAP_MIN} game minutes of play`,
      pass: rs.length === WINNERS.length * ctx.seeds && bad.length === 0,
      detail: bad.length === 0 ? `all ${rs.length} runs bought the core` : `not won: ${bad.map((r) => `${r.strategy}/${r.seed} ${r.outcome} at ${(r.playTicks / tr / 60).toFixed(1)} min`).join(', ')}`,
    });
  }

  // 2. Drones don't fit.
  {
    const name = "Drones don't fit: every tier 2 and tier 3 heart is closed to drones alone at the tier's limit (starved: tier 2 at L1, tier 3 at L2), and drones-only reclaims no tier 2 or tier 3 area on any seed";
    const t2 = every(rowsOf(2, 'starved'), (r) => singleClosedAt(r.drones, L.l1), (r) => `drones ${n(r.drones)} vs L1 ${L.l1}`);
    const t3 = every(rowsOf(3, 'starved'), (r) => singleClosedAt(r.drones, L.l2), (r) => `drones ${n(r.drones)} vs L2 ${L.l2}`);
    const dr = results.filter((r) => r.strategy === 'drones-only');
    const heavy = dr.flatMap((r) => r.reclaimOrder.filter((id) => (tiers[id] ?? 0) >= 2).map((id) => `${r.seed}:${id}`));
    const probeOk = probe !== null && t2.pass && t3.pass;
    flags.push({
      name,
      pass: probeOk && dr.length === ctx.seeds && heavy.length === 0,
      detail: `${probe === null ? NO_PROBE : `${t2.detail}; ${t3.detail}`}; drones-only: ${dr.length === 0 ? 'no runs' : heavy.length === 0 ? `no tier 2/3 area reclaimed (reclaimed: ${dr.map((r) => `seed ${r.seed} ${r.reclaimOrder.join('>') || '-'}`).join(', ')})` : `reclaimed ${heavy.join(', ')}`}`,
    });
  }

  // 3. The best local mix fits.
  {
    const name = 'The best local mix fits: tier 1 at L0 with drones, tier 2 starved at L0 and fed at L1, tier 3 starved at L1 and fed at L2';
    const parts = [
      every(rowsOf(1, 'fed'), (r) => singleFitsAt(r.drones, L.l0), (r) => `drones ${n(r.drones)} vs L0-2 ${L.l0 - 2}`),
      every(rowsOf(2, 'starved'), (r) => fitsAt(r.mix, L.l0), (r) => `mix ${n(r.mix)} vs L0-2 ${L.l0 - 2}`),
      every(rowsOf(2, 'fed'), (r) => fitsAt(r.mix, L.l1), (r) => `mix ${n(r.mix)} vs L1-2 ${L.l1 - 2}`),
      every(rowsOf(3, 'starved'), (r) => fitsAt(r.mix, L.l1), (r) => `mix ${n(r.mix)} vs L1-2 ${L.l1 - 2}`),
      every(rowsOf(3, 'fed'), (r) => fitsAt(r.mix, L.l2), (r) => `mix ${n(r.mix)} vs L2-2 ${L.l2 - 2}`),
    ];
    flags.push({ name, pass: probe !== null && parts.every((p) => p.pass), detail: probe === null ? NO_PROBE : parts.map((p) => p.detail).join('; ') });
  }

  // 4. Both counters needed.
  {
    const name = "Both counters needed: no single type fits either medium's fed heart at L1, and the best mix does";
    const p = every(
      rowsOf(2, 'fed'),
      (r) => ![r.drones, r.lancers, r.flak].some((v) => singleFitsAt(v, L.l1)) && fitsAt(r.mix, L.l1),
      (r) => `d/l/f ${n(r.drones)}/${n(r.lancers)}/${n(r.flak)}, mix ${n(r.mix)}, fit means <= ${L.l1 - 2}`,
    );
    flags.push({ name, pass: probe !== null && p.pass, detail: probe === null ? NO_PROBE : p.detail });
  }

  // 5. A raise opens an area.
  {
    const name = "A raise opens an area: every medium's fed heart is closed at L0, every Deep layout's fed heart is closed at L1 and fits at L2, and no-command does not buy the core on any seed";
    const med = every(rowsOf(2, 'fed'), (r) => closedAt(r.mix, L.l0), (r) => `mix ${n(r.mix)} vs L0 ${L.l0}`);
    const deep = every(rowsOf(3, 'fed'), (r) => closedAt(r.mix, L.l1) && fitsAt(r.mix, L.l2), (r) => `mix ${n(r.mix)} vs L1 ${L.l1} / L2-2 ${L.l2 - 2}`);
    const nc = results.filter((r) => r.strategy === 'no-command');
    const bought = nc.filter((r) => r.research.some((b) => b.item === 'core'));
    flags.push({
      name,
      pass: probe !== null && med.pass && deep.pass && nc.length === ctx.seeds && bought.length === 0,
      detail: `${probe === null ? NO_PROBE : `${med.detail}; ${deep.detail}`}; no-command: ${nc.length === 0 ? 'no runs' : nc.map((r) => `seed ${r.seed} ${r.outcome}, reclaimed ${r.reclaimOrder.join('>') || '-'}${r.research.some((b) => b.item === 'core') ? ' (bought the core)' : ''}`).join(', ')}`,
    });
  }

  // 6. Composition varies.
  {
    const name = `Composition varies: on every seed, the lancer share of the best mix differs by at least ${GAP_PP} percentage points between at least two tier 2 or 3 hearts (fed or starved)`;
    const parts: string[] = [];
    let all = probe !== null && ctx.seeds > 0;
    for (const s of seedList) {
      const rows = (probe ?? []).filter((r) => r.tier >= 2 && (r.tier === 2 || r.seed === s));
      const shares = rows.map((r) => ({ r, pct: lancerSharePct(r) })).filter((x): x is { r: HeartProbe; pct: number } => x.pct !== null);
      const lo = shares.reduce<(typeof shares)[number] | null>((b, x) => (b === null || x.pct < b.pct ? x : b), null);
      const hi = shares.reduce<(typeof shares)[number] | null>((b, x) => (b === null || x.pct > b.pct ? x : b), null);
      const gap = lo && hi ? hi.pct - lo.pct : null;
      if (gap === null || gap < GAP_PP) all = false;
      parts.push(`seed ${s}: ${gap === null ? 'no mixes' : `${lo!.pct}% ${label(lo!.r)} to ${hi!.pct}% ${label(hi!.r)}, gap ${gap} pp`}`);
    }
    flags.push({ name, pass: all, detail: probe === null ? NO_PROBE : parts.join('; ') });
  }

  flags.push({ name: 'Determinism and the reference replay pass', pass: determinismOk, detail: determinismDetail });
  return flags;
}
