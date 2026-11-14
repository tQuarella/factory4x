import {
  BUILD_TYPES,
  PROBE,
  fleetCap,
  guardianAt,
  heartIndex,
  isGuarded,
  isMineable,
  isTypeUnlocked,
  type Input,
  type ShipType,
  type ShipTypeCounts,
  type SimData,
  type World,
} from '@factory4x/sim';
import { fieldMix, fullRaidAwayCounts, guardFull, guardsAtHome } from './field-estimate.ts';
import type { FieldBot, FieldStrategy, Weights } from './field-runner.ts';
import { raisedMix } from './strategies.ts';

/**
 * The H7 field strategies (DESIGN.md H7 "Bots (H7): strategies"). Bots see what a player sees: the world through
 * the sim's selectors and plain reads (the raid is read from `world.raid` and `world.stats.raids`, which are what
 * `raidStatus` reports). The only battle estimate is the min-wave estimate (field-estimate.ts). A bot keeps its own
 * memory in its closure (made per run), so a run is a pure function of the seed and the data.
 */

/** Econ count at which `adaptive` shifts to offence (DESIGN.md: "At econ >= 12"). */
export const OFFENCE_AT_ECON = 12;
/** The most waves raised before a node is attacked again with the H3 (5/4) raise, so a node never becomes unwinnable on paper. */
const MAX_RAISE = 4;
/** Economy ships the trade in slots leaves free beyond the plan: ships already paid for in the bays and one hauler for the counter pocket still land after the weights drop. */
const ECON_MARGIN = 3;

const ZERO: Weights = { extractor: 0, hauler: 0, drone: 0, lancer: 0, flak: 0 };
const WARSHIPS: readonly ShipType[] = ['drone', 'lancer', 'flak'];

// ---- Reading the world ----------------------------------------------------------------------------------------

/** Economy ships alive and in the bays, by type. */
export function econCounts(world: Readonly<World>): { extractor: number; hauler: number } {
  const f = world.field!;
  const c = { extractor: 0, hauler: 0 };
  for (const s of f.econ) c[s.type]++;
  c.extractor += f.bays.extractor.ticksLeft > 0 ? 1 : 0;
  c.hauler += f.bays.hauler.ticksLeft > 0 ? 1 : 0;
  return c;
}

/** Economy ships alive (R2's `econ`: the ships in the bays are not counted). */
export const econAliveNow = (world: Readonly<World>): number => world.field!.econ.length;

/** Extractor slots on the nodes that can be mined now (Mine-marked, not guarded), less the free extractors. */
export function openSlots(world: Readonly<World>): number {
  let n = 0;
  for (const node of world.nodes) if (node.kind !== 'probe' && isMineable(world, node.index)) n += Math.max(0, node.slots - world.field!.free[node.index]!);
  return n;
}

/** Warships parked (not in transit) at each node: node -> counts by type. */
export function parkedWarships(world: Readonly<World>): Map<number, ShipTypeCounts> {
  const out = new Map<number, ShipTypeCounts>();
  for (const s of world.ships) {
    if (s.at === null || s.transit !== null) continue;
    let c = out.get(s.at);
    if (c === undefined) {
      c = { drone: 0, lancer: 0, flak: 0 };
      out.set(s.at, c);
    }
    c[s.type]++;
  }
  return out;
}

const total = (c: Readonly<ShipTypeCounts>): number => c.drone + c.lancer + c.flak;
const covers = (have: Readonly<ShipTypeCounts>, need: Readonly<ShipTypeCounts>): boolean => have.drone >= need.drone && have.lancer >= need.lancer && have.flak >= need.flak;

/** The warship types that can be built now (unlocked), minus `except`. */
function unlockedWarships(world: Readonly<World>, dronesOnly: boolean): ShipType[] {
  return WARSHIPS.filter((t) => isTypeUnlocked(world, t) && (!dronesOnly || t === 'drone'));
}

/** The setAlloc inputs that move the weights to `target` (clamped to alloc.maxWeight); none when nothing changes. */
export function weightInputs(world: Readonly<World>, target: Readonly<Weights>): Input[] {
  const out: Input[] = [];
  const max = world.tun['alloc.maxWeight'];
  for (const type of BUILD_TYPES) {
    const w = Math.max(0, Math.min(max, target[type]));
    if (world.field!.alloc[type] !== w) out.push({ type: 'setAlloc', shipType: type, weight: w });
  }
  return out;
}

/** The room warships have under the fleet limit: the cap less the economy (alive and building), or `fallback` with no limit. */
function warshipRoom(world: Readonly<World>, data: SimData, fallback: number): number {
  const cap = fleetCap(world, data);
  if (cap === null) return fallback;
  if (world.tun['fleet.countsEconomy'] < 1) return cap;
  const e = econCounts(world);
  return Math.max(0, cap - e.extractor - e.hauler);
}

/** How far the estimate searches: the fleet limit, or this when there is none. */
const NO_LIMIT_SEARCH = 60;
const searchMax = (world: Readonly<World>, data: SimData): number => fleetCap(world, data) ?? NO_LIMIT_SEARCH;

// ---- The economy ----------------------------------------------------------------------------------------------

/**
 * Economy weights: extractors until every open slot has one, haulers until there is one per slot, each type at
 * 0 once full (an extra extractor would idle at the probe). `lean` (offence) drops both to 1.
 */
export function economyWeights(world: Readonly<World>, lean: boolean): Pick<Weights, 'extractor' | 'hauler'> {
  const slots = openSlots(world);
  const c = econCounts(world);
  return { extractor: c.extractor >= slots ? 0 : lean ? 1 : world.tun['alloc.start.extractor'] || 3, hauler: c.hauler >= slots ? 0 : lean ? 1 : world.tun['alloc.start.hauler'] || 2 };
}

// ---- The adaptive rules ---------------------------------------------------------------------------------------

export interface AdaptiveOptions {
  /** Answer musters (the raid response and the standing guard). `greedy` turns it on after its first hit. */
  respond: boolean;
  /** Never set Lancer or Flak above 0 (the `drones-only` control). */
  dronesOnly: boolean;
  /** Offence starts when this holds (latched); `adaptive`: econ >= 12, `greedy`: every open slot has an extractor. */
  offenceGate: (world: Readonly<World>) => boolean;
}

/** The type that counters a raid's majority: Flak against Spores, Lancer against Thorns, a Drone while neither is unlocked. */
export function counterFor(world: Readonly<World>, planned: Readonly<{ thorn: number; spore: number }>, dronesOnly: boolean): ShipType {
  const want: ShipType = planned.spore > planned.thorn ? 'flak' : 'lancer';
  return !dronesOnly && isTypeUnlocked(world, want) ? want : 'drone';
}

/** The counter for the hive's majority: the type its pocket unlocks, and that pocket's node (null if the map has none). */
export function hiveCounter(world: Readonly<World>): { type: 'lancer' | 'flak'; pocket: number | null } {
  const caps = guardFull(world, heartIndex(world));
  const type = caps.spore > caps.thorn ? 'flak' : 'lancer';
  const prize = type === 'flak' ? 'ice' : 'crystal';
  const node = world.nodes.find((n) => n.kind === 'pocket' && n.prize === prize);
  return { type, pocket: node === undefined ? null : node.index };
}

/** The fleet a wave at `node` should be, raised for waves already sent (H3's 5/4 rule), or null when nothing within `upTo` wins. */
function waveFor(world: Readonly<World>, data: SimData, node: number, types: readonly ShipType[], upTo: number, counts: Readonly<{ thorn: number; spore: number }> | null): { total: number; fleet: ShipTypeCounts } | null {
  const mix = fieldMix(world, data, node, types, upTo, counts);
  if (mix === null) return null;
  const sent = Math.min(MAX_RAISE, guardianAt(world, node)!.wavesSent);
  return sent === 0 ? mix : raisedMix(mix, sent, upTo);
}

/** Weights that make a fleet in its own proportions: each type with ships gets ceil(n x max / biggest), 0 otherwise. */
export function weightsFor(world: Readonly<World>, fleet: Readonly<ShipTypeCounts>): Pick<Weights, 'drone' | 'lancer' | 'flak'> {
  const max = world.tun['alloc.maxWeight'];
  const big = Math.max(fleet.drone, fleet.lancer, fleet.flak, 1);
  const w = (n: number): number => (n <= 0 ? 0 : Math.max(1, Math.ceil((n * max) / big)));
  return { drone: w(fleet.drone), lancer: w(fleet.lancer), flak: w(fleet.flak) };
}

/** Weights for what is still missing of `fleet`: the ships alive (anywhere) are subtracted per type, so a type already covered goes to 0. */
export function deficitWeights(world: Readonly<World>, fleet: Readonly<ShipTypeCounts>): Pick<Weights, 'drone' | 'lancer' | 'flak'> {
  const have: ShipTypeCounts = { drone: 0, lancer: 0, flak: 0 };
  for (const s of world.ships) have[s.type]++;
  return weightsFor(world, { drone: Math.max(0, fleet.drone - have.drone), lancer: Math.max(0, fleet.lancer - have.lancer), flak: Math.max(0, fleet.flak - have.flak) });
}

function sendInput(from: number, to: number, counts: ShipTypeCounts): Input {
  return { type: 'sendShips', from, to, counts };
}

/** Warships parked away from `stage` (and not fighting at a living guarded node) fly to it. */
function regroup(world: Readonly<World>, parked: Map<number, ShipTypeCounts>, stage: number): Input[] {
  const out: Input[] = [];
  for (const [node, c] of parked) {
    if (node === stage || isGuarded(world, node)) continue;
    out.push(sendInput(node, stage, c));
  }
  return out;
}

/**
 * `adaptive` (and `greedy` after its first hit, and the `drones-only` and `adaptive-no-raids` variants). In order
 * each tick: answer a raid; else offence once latched; else the standing guard.
 */
export class AdaptiveBot implements FieldBot {
  private offence = false;
  /** The last raid's planned size and target: the standing guard is half of it, posted at its target. */
  private lastPlanned = 0;
  private lastRaidMix: { thorn: number; spore: number } = { thorn: 0, spore: 0 };
  private standAt: number = PROBE;
  respond: boolean;
  constructor(
    private readonly opts: Omit<AdaptiveOptions, 'respond'> & { respond: boolean },
  ) {
    this.respond = opts.respond;
  }

  decide(world: Readonly<World>, data: SimData): Input[] {
    const inputs: Input[] = [];
    const heart = heartIndex(world);
    const raid = world.raid;
    const parked = parkedWarships(world);
    if (!this.offence && this.opts.offenceGate(world)) this.offence = true;

    // Bookkeeping: the last raid's size, mix and target (the standing guard).
    if (raid !== null) {
      this.lastPlanned = raid.planned.thorn + raid.planned.spore;
      this.lastRaidMix = { ...raid.planned };
      this.standAt = raid.target;
    }
    const raidActive = this.respond && raid !== null;
    const limit = searchMax(world, data);
    const eco = economyWeights(world, this.offence);
    const w: Weights = { ...ZERO, ...eco };
    const types = unlockedWarships(world, this.opts.dronesOnly);

    // The hive window: ready for the hive at its current strength, or for the raid window.
    const hiveNow = guardsAtHome(world, heart);
    const hiveMix = this.offence ? waveFor(world, data, heart, types, limit, hiveNow) : null;
    const room = warshipRoom(world, data, limit);

    // Where the warships gather: the raid's target while answering one, the standing post otherwise.
    const stage = raidActive ? raid.target : this.respond && this.standAt !== PROBE && world.field!.mine[this.standAt] ? this.standAt : PROBE;
    if (world.rally !== stage) inputs.push({ type: 'setRally', node: stage });
    const here = parked.get(stage) ?? { drone: 0, lancer: 0, flak: 0 };

    // 1. Offence first when the hive can be taken right now (the raid window included: raiders away shrink hiveNow).
    if (this.offence && isGuarded(world, heart) && hiveMix !== null && covers(here, hiveMix.fleet) && guardianAt(world, heart)!.battle === null && raid?.phase !== 'fight') {
      Object.assign(w, deficitWeights(world, hiveMix.fleet));
      this.limitEconomy(world, data, w, types, limit);
      inputs.push(...weightInputs(world, w));
      inputs.push(sendInput(stage, heart, here));
      return inputs;
    }

    if (raidActive) {
      // 2. Answer the raid: the counter for its majority at full weight until the defence matches it, sent to the target.
      const counter = counterFor(world, raid.planned, this.opts.dronesOnly);
      const defenders = total(here) + this.inFlightTo(world, stage);
      const need = raid.planned.thorn + raid.planned.spore;
      if (defenders < need) w[counter] = world.tun['alloc.maxWeight'];
      inputs.push(...regroup(world, parked, stage));
      inputs.push(...weightInputs(world, w));
      return inputs;
    }

    // 3. Counter pocket (the hive's majority counter), once offence has started or a raid has been answered.
    const counter = hiveCounter(world);
    if (!this.opts.dronesOnly && counter.pocket !== null && isGuarded(world, counter.pocket) && !isTypeUnlocked(world, counter.type) && (this.offence || (this.respond && world.stats.raids.mustered > 0))) {
      const pocketMix = waveFor(world, data, counter.pocket, ['drone'], limit, guardsAtHome(world, counter.pocket));
      if (pocketMix !== null && pocketMix.total <= room) {
        if (covers(here, pocketMix.fleet) && guardianAt(world, counter.pocket)!.battle === null) {
          inputs.push(sendInput(stage, counter.pocket, pocketMix.fleet));
        }
        Object.assign(w, deficitWeights(world, pocketMix.fleet));
        this.limitEconomy(world, data, w, types, limit);
        inputs.push(...weightInputs(world, w));
        inputs.push(...regroup(world, parked, stage));
        return inputs;
      }
    }

    if (this.offence && isGuarded(world, heart)) {
      // 4. Build for the hive: the wave for its strength now when it fits the room; else for the raid window (the
      // hive with a full-size raid away), and wait there for a raid to go out.
      let plan = hiveMix !== null && hiveMix.total <= room ? hiveMix : null;
      if (plan === null) {
        const away = fullRaidAwayCounts(world, heart).home;
        const m = waveFor(world, data, heart, types, limit, away);
        if (m !== null && m.total <= room) plan = m;
      }
      if (plan !== null) Object.assign(w, deficitWeights(world, plan.fleet));
      this.limitEconomy(world, data, w, types, limit);
      inputs.push(...regroup(world, parked, stage));
      inputs.push(...weightInputs(world, w));
      return inputs;
    }

    // 5. The standing guard: half the last raid, counter type for it, until there is that many.
    if (this.respond && this.lastPlanned > 0) {
      const guard = Math.ceil(this.lastPlanned / 2);
      const have = total(here) + this.inFlightTo(world, stage);
      if (have < guard) {
        w[counterFor(world, this.lastRaidMix, this.opts.dronesOnly)] = world.tun['alloc.maxWeight'];
      }
    }
    inputs.push(...regroup(world, parked, stage));
    inputs.push(...weightInputs(world, w));
    return inputs;
  }

  /**
   * The trade in slots: in offence the economy grows only while one more ship still leaves the fleet limit room
   * for the smallest hive wave (the hive as it is now, or with a full-size raid away when raids are on, the
   * counter included). It never stops a hauler that has to reach the counter's pocket: that first delivery is
   * what unlocks the counter.
   */
  private limitEconomy(world: Readonly<World>, data: SimData, w: Weights, types: readonly ShipType[], limit: number): void {
    const cap = fleetCap(world, data);
    if (!this.offence || cap === null || world.tun['fleet.countsEconomy'] < 1) return;
    const heart = heartIndex(world);
    const counter = hiveCounter(world);
    const withCounter = this.opts.dronesOnly || types.includes(counter.type) ? types : [...types, counter.type];
    const totals: number[] = [];
    const now = waveFor(world, data, heart, withCounter, limit, guardsAtHome(world, heart));
    if (now !== null) totals.push(now.total);
    if (world.tun['raid.enabled'] >= 1) {
      const away = waveFor(world, data, heart, withCounter, limit, fullRaidAwayCounts(world, heart).home);
      if (away !== null) totals.push(away.total);
    }
    const e = econCounts(world);
    if (totals.length > 0 && e.extractor + e.hauler + ECON_MARGIN + Math.min(...totals) <= cap) return;
    w.extractor = 0;
    w.hauler = 0;
    if (!this.opts.dronesOnly && counter.pocket !== null && !isGuarded(world, counter.pocket) && !isTypeUnlocked(world, counter.type)) {
      let served = false;
      for (const s of world.field!.econ) if (s.type === 'hauler' && s.target === counter.pocket) served = true;
      if (!served && economyWeights(world, true).hauler > 0) w.hauler = 1;
    }
  }

  /** Warships in flight to `node`. */
  private inFlightTo(world: Readonly<World>, node: number): number {
    let n = 0;
    for (const s of world.ships) if (s.transit !== null && s.transit.to === node) n++;
    return n;
  }
}

// ---- The strategies -------------------------------------------------------------------------------------------

const adaptiveOpts = (over: Partial<AdaptiveOptions> = {}): AdaptiveOptions => ({
  respond: true,
  dronesOnly: false,
  offenceGate: (w) => econAliveNow(w) >= OFFENCE_AT_ECON,
  ...over,
});

/** `greedy`: all economy until every open slot has an extractor, no warships, ignoring musters; its first hit turns it into `adaptive`. */
class GreedyBot implements FieldBot {
  private readonly inner = new AdaptiveBot(adaptiveOpts({ respond: false, offenceGate: (w) => econCounts(w).extractor >= openSlots(w) && openSlots(w) > 0 }));
  decide(world: Readonly<World>, data: SimData): Input[] {
    if (!this.inner.respond && world.stats.raids.hit >= 1) this.inner.respond = true;
    return this.inner.decide(world, data);
  }
}

/** `idle`: holds econ at raid.firstAtEcon - 1, then builds warships only. */
class IdleBot implements FieldBot {
  decide(world: Readonly<World>): Input[] {
    const f = world.field!;
    const c = econCounts(world);
    // A full share starts its bay next tick, so it counts as built.
    const pending = (['extractor', 'hauler'] as const).filter((t) => f.bays[t].ticksLeft === 0 && f.share[t] > 0 && f.share[t] >= world.tun[`ship.${t}.cost`]).length;
    const hold = world.tun['raid.firstAtEcon'] - 1;
    const w: Weights = { ...ZERO };
    if (c.extractor + c.hauler + pending < hold) {
      w.extractor = world.tun['alloc.start.extractor'] || 3;
      w.hauler = world.tun['alloc.start.hauler'] || 2;
    } else w.drone = world.tun['alloc.maxWeight'];
    return weightInputs(world, w);
  }
}

/** A `static` allocation: fixed weights from tick 0, attacking when the min-wave estimate fits what it has built. */
export interface StaticShape {
  name: string;
  weights: Weights;
}

/** The sweep (DESIGN.md: "the best of at most 6 fixed allocations from a small sweep, fixed in the code, listed in the report"). Order: extractor / hauler / drone / lancer / flak. */
export const STATIC_SHAPES: readonly StaticShape[] = [
  { name: 'econ-lean 4/3/1/1/1', weights: { extractor: 4, hauler: 3, drone: 1, lancer: 1, flak: 1 } },
  { name: 'even 3/2/2/2/2', weights: { extractor: 3, hauler: 2, drone: 2, lancer: 2, flak: 2 } },
  { name: 'drone-heavy 3/2/4/1/1', weights: { extractor: 3, hauler: 2, drone: 4, lancer: 1, flak: 1 } },
  { name: 'flak-heavy 3/2/1/1/4', weights: { extractor: 3, hauler: 2, drone: 1, lancer: 1, flak: 4 } },
  { name: 'lancer-heavy 3/2/1/4/1', weights: { extractor: 3, hauler: 2, drone: 1, lancer: 4, flak: 1 } },
  { name: 'war-lean 2/1/3/2/3', weights: { extractor: 2, hauler: 1, drone: 3, lancer: 2, flak: 3 } },
];

class StaticBot implements FieldBot {
  constructor(private readonly weights: Weights) {}
  decide(world: Readonly<World>, data: SimData): Input[] {
    const inputs = weightInputs(world, this.weights);
    const limit = searchMax(world, data);
    const parked = parkedWarships(world);
    const here = parked.get(PROBE) ?? { drone: 0, lancer: 0, flak: 0 };
    const types = WARSHIPS.filter((t) => this.weights[t] > 0 && isTypeUnlocked(world, t));
    // The guarded nodes, the cheapest estimate first: attack the first one the ships at the probe can take.
    const rows: { node: number; mix: { total: number; fleet: ShipTypeCounts } }[] = [];
    for (const g of world.guardians) {
      if (!g.alive || g.battle !== null) continue;
      const m = waveFor(world, data, g.node, types, limit, guardsAtHome(world, g.node));
      if (m !== null) rows.push({ node: g.node, mix: m });
    }
    rows.sort((a, b) => a.mix.total - b.mix.total || a.node - b.node);
    for (const r of rows) {
      if (covers(here, r.mix.fleet)) {
        inputs.push(sendInput(PROBE, r.node, r.node === heartIndex(world) ? here : r.mix.fleet));
        break;
      }
    }
    inputs.push(...regroup(world, parked, PROBE));
    return inputs;
  }
}

/** A `static` strategy with the given shape. */
export function staticStrategy(shape: StaticShape): FieldStrategy {
  return {
    name: 'static',
    description: `fixed allocation ${shape.name}, never changed after tick 0; attacks when the estimate fits`,
    expectedWin: false,
    make: () => new StaticBot(shape.weights),
  };
}

export const adaptive: FieldStrategy = {
  name: 'adaptive',
  description: 'economy first; answers a muster with the counter type at the target; takes the counter pocket; offence at econ 12, attacking when the best mix fits, preferring a raid out',
  expectedWin: true,
  make: () => new AdaptiveBot(adaptiveOpts()),
};
export const greedy: FieldStrategy = {
  name: 'greedy',
  description: 'all economy until every open slot has an extractor, no warships, ignores musters; after its first hit it plays adaptive',
  expectedWin: true,
  make: () => new GreedyBot(),
};
export const idle: FieldStrategy = {
  name: 'idle',
  description: 'holds econ at raid.firstAtEcon - 1, then builds warships only',
  expectedWin: false,
  make: () => new IdleBot(),
};
export const dronesOnly: FieldStrategy = {
  name: 'drones-only',
  description: 'adaptive, but Lancer and Flak stay at 0',
  expectedWin: false,
  make: () => new AdaptiveBot(adaptiveOpts({ dronesOnly: true })),
};
export const adaptiveNoRaids: FieldStrategy = {
  name: 'adaptive-no-raids',
  description: 'adaptive with raid.enabled 0 (the A/B comparison, report only)',
  expectedWin: false,
  tunables: { 'raid.enabled': 0 },
  make: () => new AdaptiveBot(adaptiveOpts()),
};

/** The strategies the gate runs (static is run as its sweep and reported as the best shape). */
export const FIELD_STRATEGY_NAMES = ['adaptive', 'greedy', 'static', 'idle', 'drones-only', 'adaptive-no-raids'] as const;
/** The strategies the gate expects to win. */
export const FIELD_WINNERS: readonly string[] = ['adaptive', 'greedy'];
/** Every non-static strategy, in report order. */
export const fieldStrategies: readonly FieldStrategy[] = [adaptive, greedy, idle, dronesOnly, adaptiveNoRaids];
