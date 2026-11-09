import { performance } from 'node:perf_hooks';
import {
  RAW_RESOURCES,
  campaignSummary,
  campaignWorld,
  createWorld,
  isWon,
  fleetCap,
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
import { closedAt, fitsAt, type HeartProbe, type ProbeLimits, type Trial, type TrialKind } from './waves.ts';

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
  /** Waves repelled in the visit. */
  repelled: number;
  /** The Root was cut before the heart fell (reclaimed visits): null when the area has no Root. */
  rootCutBeforeHeart: boolean | null;
  /** The fleet limit the visit played under (null: off), and, for a reclaimed visit, the haul the reclaim paid (decayed for a repeat). */
  limit: number | null;
  haulPaid: ResourceTriple | null;
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
  /** Waves repelled over the run (battles that ended without the node falling): any gap between the probe and play. */
  repelled: number;
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
  /** Stop after this many visits have ended, reclaimed or not (the trial visits). */
  stopAfterVisits?: number;
  /** Play the first visit even when nothing passes the attack test (the trial visits are never withdrawn as closed). */
  forceFirstVisit?: boolean;
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
  let visit: { area: number; startTick: number; openingTicks: number | null; forced: boolean; limit: number | null } | null = null;
  let nextForced = opts.forceFirstVisit === true;
  let loggedResearch = camp.researchLog.length;
  let reclaims = 0;
  let repelledTotal = 0;
  let visitRepelled = 0;
  let lastBattleEnd = -1;
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
      repelled: visitRepelled,
      limit: visit.limit,
      haulPaid: result === 'reclaimed' && rec.haulPaid !== null ? { ...rec.haulPaid } : null,
      rootCutBeforeHeart: result === 'reclaimed' && rootIndex(world) >= 0 ? s.rootCutTick !== null : null,
      wave: result === 'reclaimed' && world.lastBattle !== null && world.lastBattle.node === heartIndex(world) ? { ...world.lastBattle.engagedByType } : null,
    });
    if (result === 'reclaimed') reclaims++;
    visit = null;
    visitRepelled = 0;
  };

  try {
    for (;;) {
      if (isWon(world)) {
        outcome = 'won';
        break;
      }
      if (opts.stopAfterReclaims !== undefined && reclaims >= opts.stopAfterReclaims) break;
      if (opts.stopAfterVisits !== undefined && visits.length >= opts.stopAfterVisits) break;
      if (playTicksNow(world) >= opts.campaignCapTicks) break;
      let inputs: Input[];
      const inArea = camp.active !== null;
      if (inArea) {
        if (visit === null) visit = { area: camp.active!, startTick: camp.areaStartTick, openingTicks: null, forced: nextForced, limit: fleetCap(world, data) };
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
      const lb = world.lastBattle;
      if (lb !== null && lb.endTick !== lastBattleEnd) {
        lastBattleEnd = lb.endTick;
        if (lb.outcome === 'repelled') {
          repelledTotal++;
          visitRepelled++;
        }
      }
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
    repelled: repelledTotal,
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
export interface H6Flag {
  name: string;
  pass: boolean;
  detail: string;
}

/** What the flags need besides the runs, the probe and the trials: tick rate, the tier and relay marks of each area id, the probe's limits. */
export interface FlagContext {
  tickRate: number;
  tiers: Readonly<Record<string, number>>;
  /** Area ids of the command relays. */
  relays: readonly string[];
  limits: ProbeLimits;
  seeds: number;
}

/** Lancer share of a probe row's best mix, in whole percent (integer), or null without a mix. */
export function lancerSharePct(row: Pick<HeartProbe, 'mix' | 'mixFleet'>): number | null {
  if (row.mix === null || row.mixFleet === null || row.mix === 0) return null;
  return Math.floor((row.mixFleet.lancer * 100) / row.mix);
}

/** The strategies flag 1 covers (the ones meant to win). */
const WINNERS = WINNING_STRATEGIES;
/** A counter type counts toward the mix when it is at least this share of the capturing wave (flag 4). */
export const MIX_SHARE_PCT = 30;
/** The capturing wave must be at least L minus this many ships (flag 5). */
export const WAVE_SLACK = 6;

const total = (w: Readonly<ShipTypeCounts>): number => w.drone + w.lancer + w.flak;

/** Both counter types make up at least MIX_SHARE_PCT of the wave (integer test: n × 100 ≥ share × total). */
export function isMixedWave(w: Readonly<ShipTypeCounts>): boolean {
  const t = total(w);
  return t > 0 && w.lancer * 100 >= MIX_SHARE_PCT * t && w.flak * 100 >= MIX_SHARE_PCT * t;
}

/** One trial visit and what it did. */
export interface TrialResult {
  kind: TrialKind;
  area: string;
  seed: number;
  /** The limit the visit played under (from the world), and the limit the trial expects. */
  limit: number | null;
  expectedLimit: number;
  reclaimed: boolean;
  /** 'reclaimed', 'timeout' (the visit cap) or 'closed' (nothing passed the attack test: not reached as trials are forced). */
  result: 'reclaimed' | 'timeout' | 'closed' | 'none';
  playTicks: number;
}

/** Play one trial: the composer engine for a forced visit up to `visitCapTicks`, landed from campaignWorld. */
export function runTrial(trial: Trial, data: SimData, visitCapTicks: number): TrialResult {
  const strategy: CampaignStrategy = { name: `trial-${trial.kind}`, description: '', kit: 'none', dronesOnly: trial.dronesOnly };
  const r = runCampaign(strategy, trial.seed, data, {
    start: trial.start,
    visitCapTicks,
    campaignCapTicks: visitCapTicks * 2,
    stopAfterVisits: 1,
    forceFirstVisit: true,
  });
  if (r.error !== undefined) throw new Error(`trial ${trial.kind} ${trial.area}: ${r.error}`);
  const v = r.visits[0];
  return {
    kind: trial.kind,
    area: trial.area,
    seed: trial.seed,
    limit: v?.limit ?? null,
    expectedLimit: trial.limit,
    reclaimed: v?.result === 'reclaimed',
    result: v === undefined ? 'none' : v.result === 'reclaimed' ? 'reclaimed' : v.closed ? 'closed' : 'timeout',
    playTicks: v?.playTicks ?? 0,
  };
}

/**
 * The bot gate's failures from the runs (DESIGN.md H6, plus the Director's h6-sim review addition): a crash of any
 * strategy, a tick p95 over budget, and, for a strategy expected to win, a softlock or a campaign timeout (the 120
 * minute cap ran out without the core). Missing a flag is never a failure.
 */
export function gateFailures(results: readonly CampaignResult[], names: readonly string[], tickBudgetMsP95: number, tickRate: number): string[] {
  const out: string[] = [];
  const mins = (ticks: number): string => `${(ticks / tickRate / 60).toFixed(1)} min`;
  for (const name of names) {
    const rs = results.filter((r) => r.strategy === name);
    for (const r of rs) {
      if (r.outcome === 'crash') out.push(`${name} seed ${r.seed}: crash (${(r.error ?? '').split('\n')[0]})`);
      if (WINNERS.includes(name) && r.outcome === 'softlock') out.push(`${name} seed ${r.seed}: softlock (a second visit timeout or nothing to do, at ${mins(r.playTicks)} of play)`);
      if (WINNERS.includes(name) && r.outcome === 'timeout') out.push(`${name} seed ${r.seed}: campaign timeout (no core after ${mins(r.playTicks)} of play, the ${CAMPAIGN_CAP_MIN} minute cap)`);
    }
    const p95 = rs.length === 0 ? 0 : Math.max(...rs.map((r) => r.tickMsP95));
    if (p95 > tickBudgetMsP95) out.push(`${name}: tick p95 ${p95.toFixed(3)}ms exceeds budget ${tickBudgetMsP95}ms`);
  }
  return out;
}

/**
 * The seven H6 flags (DESIGN.md H6 "Bots (H6)") as report lines. Each measures what can or can't be done, never a
 * time gap. `probe` is the minimum-wave probe and `trials` the trial visits (null if not run).
 */
export function computeH6Flags(
  results: readonly CampaignResult[],
  probe: readonly HeartProbe[] | null,
  trials: readonly TrialResult[] | null,
  ctx: FlagContext,
  determinismOk: boolean,
  determinismDetail = '',
): H6Flag[] {
  const { limits: L, tickRate: tr } = ctx;
  const flags: H6Flag[] = [];
  const NO_PROBE = 'probe not run';
  const rowsOf = (tier: number): HeartProbe[] => (probe ?? []).filter((r) => r.tier === tier && r.state === 'fed');
  const label = (r: HeartProbe): string => `${r.area}${r.layout !== null ? `/${r.layout}` : ''}`;
  const n = (v: number | null): string => (v === null ? '>80' : String(v));
  const every = (rows: HeartProbe[], ok: (r: HeartProbe) => boolean, show: (r: HeartProbe) => string): { pass: boolean; detail: string } => ({
    pass: rows.length > 0 && rows.every(ok),
    detail: rows.length === 0 ? 'no rows' : rows.map((r) => `${label(r)} ${show(r)} ${ok(r) ? 'ok' : 'MISS'}`).join('; '),
  });
  const winners = results.filter((r) => WINNERS.includes(r.strategy) && r.outcome === 'won');
  const NO_WINNERS = 'no winning runs';
  /** Pass if there are winners and every one satisfies `ok`; the detail lists each. */
  const perWinner = (ok: (r: CampaignResult) => boolean, show: (r: CampaignResult) => string): { pass: boolean; detail: string } => ({
    pass: winners.length > 0 && winners.every(ok),
    detail: winners.length === 0 ? NO_WINNERS : winners.map((r) => `${r.strategy}/${r.seed} ${show(r)} ${ok(r) ? 'ok' : 'MISS'}`).join('; '),
  });
  const waveText = (v: Visit): string => (v.wave === null ? 'no wave' : `${v.wave.drone}d/${v.wave.lancer}l/${v.wave.flak}f`);
  const reclaimed = (r: CampaignResult): Visit[] => r.visits.filter((v) => v.result === 'reclaimed');

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

  // 2. A relay opens a band.
  {
    const band2 = every(rowsOf(2), (r) => closedAt(r.mix, L.l0) && fitsAt(r.mix, L.l1), (r) => `mix ${n(r.mix)} vs L0 ${L.l0} / L1-2 ${L.l1 - 2}`);
    const deep = every(rowsOf(3), (r) => closedAt(r.mix, L.l1) && fitsAt(r.mix, L.l2), (r) => `mix ${n(r.mix)} vs L1 ${L.l1} / L2-2 ${L.l2 - 2}`);
    flags.push({
      name: 'A relay opens a band: every band 2 heart is closed at L0 and every Deep layout is closed at L1 with any local mix, and each fits at the next limit',
      pass: probe !== null && band2.pass && deep.pass,
      detail: probe === null ? NO_PROBE : `${band2.detail}; ${deep.detail}`,
    });
  }

  // 3. The lock is real.
  {
    const kinds: TrialKind[] = ['band2-l0', 'deep-l1', 'relay-drones'];
    const done = trials ?? [];
    const held = done.filter((t) => !t.reclaimed);
    const missingKinds = kinds.filter((k) => !done.some((t) => t.kind === k));
    flags.push({
      name: 'The lock is real: no trial visit reclaims its area (band 2 at L0, The Deep at L1, band 1 relays with drones only, a full composer visit each)',
      pass: trials !== null && missingKinds.length === 0 && held.length === done.length,
      detail:
        trials === null
          ? 'trials not run'
          : `${done.map((t) => `${t.kind} ${t.area}${t.kind === 'deep-l1' ? `/seed ${t.seed}` : ''} ${t.reclaimed ? `RECLAIMED at ${tickMmss(t.playTicks, tr)}` : t.result} (limit ${t.limit ?? 'off'})`).join('; ')}${missingKinds.length > 0 ? `; no trials of kind ${missingKinds.join(', ')}` : ''}`,
    });
  }

  // 4. The mix is used.
  {
    const p = perWinner(
      (r) => reclaimed(r).some((v) => (ctx.tiers[v.area] ?? 0) >= 2 && v.wave !== null && isMixedWave(v.wave)),
      (r) => `band 2+ waves ${reclaimed(r).filter((v) => (ctx.tiers[v.area] ?? 0) >= 2).map((v) => `${v.area} ${waveText(v)}`).join(', ') || 'none'}`,
    );
    flags.push({ name: `The mix is used: every winning run captures a band 2 or higher heart with a wave in which lancers and flak are each at least ${MIX_SHARE_PCT}% of the ships`, pass: p.pass, detail: p.detail });
  }

  // 5. The new limit is used.
  {
    const isRelay2 = (id: string): boolean => ctx.relays.includes(id) && ctx.tiers[id] === 2;
    const checked = (r: CampaignResult): Visit[] => reclaimed(r).filter((v) => isRelay2(v.area) || ctx.tiers[v.area] === 3);
    const full = (v: Visit): boolean => v.wave !== null && v.limit !== null && total(v.wave) >= v.limit - WAVE_SLACK;
    const p = perWinner(
      (r) => checked(r).length > 0 && checked(r).every(full),
      (r) => checked(r).map((v) => `${v.area} ${v.wave === null ? 0 : total(v.wave)} ships vs limit ${v.limit ?? 'off'}`).join(', ') || 'no band 2 relay or Deep capture',
    );
    flags.push({ name: `The new limit is used: in every winning run the capturing wave at the band 2 relay it took and at The Deep has at least L - ${WAVE_SLACK} ships`, pass: p.pass, detail: p.detail });
  }

  // 6. The set is a choice.
  {
    const left = perWinner((r) => r.skipped.length > 0, (r) => `untaken ${r.skipped.length}: ${r.skipped.join(', ')}`);
    const parts: string[] = [];
    let differ = ctx.seeds > 0;
    for (let seed = 1; seed <= ctx.seeds; seed++) {
      const sets = new Set(winners.filter((r) => r.seed === seed).map((r) => [...r.reclaimOrder].sort().join(',')));
      if (sets.size < 2) differ = false;
      parts.push(`seed ${seed}: ${winners.filter((r) => r.seed === seed).length} winners, ${sets.size} distinct sets`);
    }
    flags.push({
      name: 'The set is a choice: every winning run leaves at least one area untaken, and on each seed at least two winners end with different sets of reclaimed areas',
      pass: left.pass && differ,
      detail: `${left.detail}; ${parts.join('; ')}`,
    });
  }

  flags.push({ name: 'Determinism and the reference replay pass', pass: determinismOk, detail: determinismDetail });
  return flags;
}
