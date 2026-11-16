import {
  BUILD_TYPES,
  PROBE,
  econAtByType,
  fieldSummary,
  fleetCap,
  isFleetFull,
  guardianAt,
  haulerTarget,
  heartIndex,
  isGuarded,
  isMineable,
  oreCost,
  isTypeUnlocked,
  isValidInput,
  nodeDistance,
  raidStatus,
  rockStatus,
  shipsAtByType,
  type Input,
  type ShipType,
  type ShipTypeCounts,
  type SimData,
  type World,
} from '@factory4x/sim';
import { fieldMix, raidAwayAtEcon, guardFull, guardsAtHome } from './field-estimate.ts';
import type { FieldBot, FieldStrategy, Weights } from './field-runner.ts';
import { raisedMix } from './strategies.ts';

/**
 * The H7 field strategies (DESIGN.md H7 "Bots (H7): strategies"). Bots see what a player sees: the sim's
 * selectors (`raidStatus`, `fleetStatus`, `allocStatus`, `rockStatus`, `fieldSummary`, `shipsAtByType`) and the
 * map's structure. The only battle estimate is the min-wave estimate (field-estimate.ts). A bot keeps its own
 * memory in its closure (made per run), so a run is a pure function of the seed and the data.
 *
 * Reads that no selector gives, kept as plain reads or exported helpers and named in the h7-bots report:
 * `guardianAt(...).wavesSent` and `.battle` (waves already sent at a node; a battle running there), where the
 * rally is (the bot remembers what it set), where a ship in flight is going, and the node list's kind and prize.
 */

/** Econ count at which `adaptive` shifts to offence (DESIGN.md: "At econ >= 12"). */
export const OFFENCE_AT_ECON = 12;
/** The most waves raised before a node is attacked again with the H3 (5/4) raise, so a node never becomes unwinnable on paper. */
const MAX_RAISE = 4;
/** Economy ships the trade in slots leaves free beyond the plan: ships already paid for in the bays and one hauler for the counter pocket still land after the weights drop. */
const ECON_MARGIN = 3;
/** Ticks between two recycle orders (one ship each), so the economy comes down at a human pace. */
const RECYCLE_EVERY = 15;

const ZERO: Weights = { extractor: 0, hauler: 0, drone: 0, lancer: 0, flak: 0 };
const WARSHIPS: readonly ShipType[] = ['drone', 'lancer', 'flak'];
const EMPTY: ShipTypeCounts = { drone: 0, lancer: 0, flak: 0 };

// ---- Reading the world ----------------------------------------------------------------------------------------

// The reads below are the numbers `fleetStatus`, `allocStatus` and `rockStatus` report, taken straight from the
// world without building a whole sheet (`fleetStatus` sorts every ship for its recycle counts, `rockStatus` ranks
// the raids): they run several times a tick, and were a fifth of the bots gate (cw-bots-gate-time).

/** Economy ships alive and in the bays, by type (fleetStatus.econByType + econBuildingByType; `data` is unused, kept for the call sites). */
export function econCounts(world: Readonly<World>, data: SimData): { extractor: number; hauler: number } {
  void data;
  const f = world.field!;
  let extractor = f.bays.extractor.ticksLeft > 0 ? 1 : 0;
  let hauler = f.bays.hauler.ticksLeft > 0 ? 1 : 0;
  for (const s of f.econ) {
    if (s.type === 'extractor') extractor++;
    else hauler++;
  }
  return { extractor, hauler };
}

/** Economy ships alive (R2's `econ`: the ships in the bays are not counted). */
export function econAliveNow(world: Readonly<World>, data: SimData): number {
  void data;
  return world.field!.econ.length;
}

/** True while any of the five bays is running (allocStatus: a row with ticksLeft above 0). */
export function anyBayRunning(world: Readonly<World>): boolean {
  return world.field!.bays.extractor.ticksLeft > 0 || world.field!.bays.hauler.ticksLeft > 0 || world.yards.drone.ticksLeft > 0 || world.yards.lancer.ticksLeft > 0 || world.yards.flak.ticksLeft > 0;
}

/** Extractor slots on the rocks that can be mined now (Mine-marked, not guarded), less the free extractors (rockStatus). */
export function openSlots(world: Readonly<World>): number {
  let n = 0;
  for (const node of world.nodes) {
    if (node.kind === 'probe') continue;
    if (isMineable(world, node.index)) n += Math.max(0, node.slots - world.field!.free[node.index]!);
  }
  return n;
}

/** Warships parked (not in transit) at each node: node -> counts by type. */
export function parkedWarships(world: Readonly<World>): Map<number, ShipTypeCounts> {
  const out = new Map<number, ShipTypeCounts>();
  for (const node of world.nodes) {
    const c = shipsAtByType(world, node.index);
    if (c.drone + c.lancer + c.flak > 0) out.set(node.index, c);
  }
  return out;
}

/**
 * Warships fit to fight, by type, at `node` (or anywhere): hp at least half the type's full hp. The min-wave
 * estimate assumes full-health ships, and survivors of an earlier fight stay wounded (a ship's hp is plain state;
 * no selector reports it), so a wounded one counts as not there.
 */
export function soundShips(world: Readonly<World>, node: number | null = null): ShipTypeCounts {
  const c: ShipTypeCounts = { drone: 0, lancer: 0, flak: 0 };
  for (const s of world.ships) if ((node === null || s.at === node) && s.hp * 2 >= world.tun[`ship.${s.type}.hp`]) c[s.type]++;
  return c;
}

const total = (c: Readonly<ShipTypeCounts>): number => c.drone + c.lancer + c.flak;
const covers = (have: Readonly<ShipTypeCounts>, need: Readonly<ShipTypeCounts>): boolean => have.drone >= need.drone && have.lancer >= need.lancer && have.flak >= need.flak;

/** The warship types that can be built now (unlocked). */
function unlockedWarships(world: Readonly<World>, dronesOnly: boolean): ShipType[] {
  return WARSHIPS.filter((t) => isTypeUnlocked(world, t) && (!dronesOnly || t === 'drone'));
}

/** The setAlloc inputs that move the weights to `target` (clamped to alloc.maxWeight); none when nothing changes. */
export function weightInputs(world: Readonly<World>, data: SimData, target: Readonly<Weights>): Input[] {
  const out: Input[] = [];
  const max = world.tun['alloc.maxWeight'];
  const alloc = world.field!.alloc;
  void data;
  for (const type of BUILD_TYPES) {
    const w = Math.max(0, Math.min(max, target[type]));
    if (alloc[type] !== w) out.push({ type: 'setAlloc', shipType: type, weight: w });
  }
  return out;
}

/** The room warships have under the fleet limit: the cap less the economy (alive and building), or `fallback` with no limit. */
function warshipRoom(world: Readonly<World>, data: SimData, fallback: number): number {
  const cap = fleetCap(world, data);
  if (cap === null) return fallback;
  if (world.tun['fleet.countsEconomy'] < 1) return cap;
  const e = econCounts(world, data);
  return Math.max(0, cap - e.extractor - e.hauler);
}

/** How far the estimate searches: the fleet limit, or this when there is none. */
const NO_LIMIT_SEARCH = 60;
const searchMax = (world: Readonly<World>, data: SimData): number => fleetCap(world, data) ?? NO_LIMIT_SEARCH;

// ---- The economy ----------------------------------------------------------------------------------------------

/** Haulers the rocks still lack: the sum over the rocks of `haulerTarget - haulers`, where positive (rockStatus; H8 H1-H4). */
export function haulerShortfall(world: Readonly<World>, kind: 'any' | 'pocket' = 'any'): number {
  // The same numbers as rockStatus(...).haulerTarget and .haulers, read without building a whole sheet per rock (this runs every tick).
  const assigned = world.nodes.map(() => 0);
  for (const s of world.field!.econ) if (s.type === 'hauler' && s.target !== null) assigned[s.target] = assigned[s.target]! + 1;
  let n = 0;
  for (const node of world.nodes) {
    if (node.kind === 'probe' || (kind === 'pocket' && node.kind !== 'pocket')) continue;
    n += Math.max(0, haulerTarget(world, node.index) - assigned[node.index]!);
  }
  return n;
}

/**
 * Economy weights: extractors until every open slot has one, 0 once full (an extra extractor would idle at the
 * probe). The Hauler weight (H8 change 1) never reaches 0 while a rock has a shortfall (`haulerTarget > haulers`);
 * H4 makes the sim stop building haulers by itself when there is none. With no shortfall it is 0 only once there
 * is a hauler per slot. `lean` (offence) drops both to 1.
 */
export function economyWeights(world: Readonly<World>, data: SimData, lean: boolean): Pick<Weights, 'extractor' | 'hauler'> {
  const slots = openSlots(world);
  const c = econCounts(world, data);
  const haulerOn = haulerShortfall(world) > 0 || c.hauler < slots;
  return { extractor: c.extractor >= slots ? 0 : lean ? 1 : world.tun['alloc.start.extractor'] || 3, hauler: !haulerOn ? 0 : lean ? 1 : world.tun['alloc.start.hauler'] || 2 };
}

// ---- The backstops (H8 changes 2 and 3) ------------------------------------------------------------------------

/** Game minutes with no bay running before "nothing to build" can apply (DESIGN.md H8 "Bots (H8)" change 3). */
const IDLE_BAYS_MIN = 2;

/**
 * The two H8 backstops, kept in a bot's closure. `apply` runs after a strategy has chosen its weights:
 *  - change 2, the economy wiped: economy ships alive plus in the bays below 2 (after the economy has once had 2)
 *    puts Extractor and Hauler back at their `alloc.start.*` weights until `econ` reaches `raid.firstAtEcon - 1`;
 *  - change 3, nothing to build: no bay running for 2 game minutes, ore for the dearest unlocked warship in stock
 *    and every warship weight at 0 puts the counter type (a Drone before a pocket is taken) at 1. It holds while
 *    the strategy's own rules still want no warship, and lets go once they do.
 */
export class Backstops {
  private recovering = false;
  private hadEcon = false;
  private lastBusy = 0;
  private nothing = false;
  constructor(private readonly dronesOnly: boolean) {}

  apply(world: Readonly<World>, data: SimData, w: Weights): void {
    if (anyBayRunning(world)) this.lastBusy = world.tick;

    // Change 3 reads the strategy's own warship weights, so it comes before change 2 edits anything.
    if (w.drone + w.lancer + w.flak > 0) this.nothing = false;
    else {
      if (!this.nothing && world.tick - this.lastBusy >= IDLE_BAYS_MIN * 60 * data.tickRate) {
        const dearest = Math.max(0, ...WARSHIPS.filter((t) => isTypeUnlocked(world, t) && (!this.dronesOnly || t === 'drone')).map((t) => oreCost(world, t)));
        if (dearest > 0 && world.stock.ore >= dearest) this.nothing = true;
      }
      if (this.nothing) {
        const counter = hiveCounter(world).type;
        w[!this.dronesOnly && isTypeUnlocked(world, counter) ? counter : 'drone'] = 1;
      }
    }

    const e = econCounts(world, data);
    const have = e.extractor + e.hauler;
    if (have >= 2) this.hadEcon = true;
    if (this.hadEcon && have < 2) this.recovering = true;
    if (this.recovering && econAliveNow(world, data) >= world.tun['raid.firstAtEcon'] - 1) this.recovering = false;
    if (this.recovering) {
      w.extractor = world.tun['alloc.start.extractor'] || 3;
      w.hauler = world.tun['alloc.start.hauler'] || 2;
    }
  }
}

// ---- The adaptive rules ---------------------------------------------------------------------------------------

export interface AdaptiveOptions {
  /** Answer musters (the raid response and the standing guard). `greedy` plays adaptive's rules, so it is on after its first hit. */
  respond: boolean;
  /** Never set Lancer or Flak above 0 (the `drones-only` control). */
  dronesOnly: boolean;
  /** Offence starts when this holds (latched). */
  offenceGate: (world: Readonly<World>, data: SimData) => boolean;
}

/** The type that counters a raid's majority: Flak against Spores, Lancer against Thorns, a Drone while neither is unlocked. */
export function counterFor(world: Readonly<World>, planned: Readonly<{ thorn: number; spore: number }>, dronesOnly: boolean): ShipType {
  const want: ShipType = planned.spore > planned.thorn ? 'flak' : 'lancer';
  return !dronesOnly && isTypeUnlocked(world, want) ? want : 'drone';
}

/** A pocket's node and the type it unlocks. */
function pocketOf(world: Readonly<World>, type: 'lancer' | 'flak'): number | null {
  const prize = type === 'flak' ? 'ice' : 'crystal';
  const node = world.nodes.find((n) => n.kind === 'pocket' && n.prize === prize);
  return node === undefined ? null : node.index;
}

/** The counter for the hive's majority: the type its pocket unlocks, and that pocket's node (null if the map has none). */
export function hiveCounter(world: Readonly<World>): { type: 'lancer' | 'flak'; pocket: number | null } {
  const caps = guardFull(world, heartIndex(world));
  const type = caps.spore > caps.thorn ? 'flak' : 'lancer';
  return { type, pocket: pocketOf(world, type) };
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

/** Weights for what is still missing of `fleet`: the ships alive (anywhere) are subtracted per type, so a covered type goes to 0. */
export function deficitWeights(world: Readonly<World>, data: SimData, fleet: Readonly<ShipTypeCounts>): Pick<Weights, 'drone' | 'lancer' | 'flak'> {
  void data;
  const have = soundShips(world);
  return weightsFor(world, { drone: Math.max(0, fleet.drone - have.drone), lancer: Math.max(0, fleet.lancer - have.lancer), flak: Math.max(0, fleet.flak - have.flak) });
}

function sendInput(from: number, to: number, counts: ShipTypeCounts): Input {
  return { type: 'sendShips', from, to, counts };
}

/**
 * The inputs that send exactly the sound ships `need` counts from `stage` to `to`, and no wounded one.
 * `sendShips` takes the lowest-id ships of each type, so per type this walks the parked ships in id order: a run
 * of sound ships is sent, and a wounded ship that would come next (the lowest id left) is recycled first (the
 * estimate can't count it, and the stage is never a living guarded node). Every send in one tick to one guarded node
 * is one wave (rule 1). Returns [] when the sound ships at the stage don't cover `need`.
 */
export function exactSend(world: Readonly<World>, stage: number, to: number, need: Readonly<ShipTypeCounts>): Input[] {
  if (!covers(soundShips(world, stage), need)) return [];
  const out: Input[] = [];
  const one = (type: ShipType, n: number): ShipTypeCounts => ({ ...EMPTY, [type]: n });
  for (const type of WARSHIPS) {
    let left = need[type];
    let run = 0;
    for (const s of world.ships) {
      if (left === 0) break;
      if (s.type !== type || s.at !== stage || s.transit !== null) continue;
      if (s.hp * 2 >= world.tun[`ship.${type}.hp`]) {
        run++;
        left--;
      } else {
        if (run > 0) out.push(sendInput(stage, to, one(type, run)));
        run = 0;
        out.push({ type: 'recycleShips', node: stage, counts: { ...one(type, 1), extractor: 0, hauler: 0 } });
      }
    }
    if (run > 0) out.push(sendInput(stage, to, one(type, run)));
  }
  return out;
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
 * each tick: attack the hive if it can be taken now; answer a raid; take the counter pocket; build for the hive
 * (and, when no plan fits the fleet limit, take the other pocket or recycle economy ships: the Director's rule);
 * else keep the standing guard. In offence every branch ends with the trade in slots (`limitEconomy`).
 */
export class AdaptiveBot implements FieldBot {
  private offence = false;
  /** The last raid's planned size and target: the standing guard is half of it, posted at its target. */
  private lastPlanned = 0;
  private lastRaidMix: { thorn: number; spore: number } = { thorn: 0, spore: 0 };
  private standAt: number = PROBE;
  /** The rally this bot last set (no selector reports it). */
  private rally: number = PROBE;
  /** True while this tick's plan Recycles economy ships toward a wave: haulers must not be built back (limitEconomy). */
  private shrinking = false;
  /** The size of the wave this tick builds for (a pocket's or the hive's), 0 with none: the room the economy must leave. */
  private waveTotal = 0;
  /** The room a wave needs the economy to leave this tick: max(smallest hive wave, the wave being built for), 0 when not in offence at a limit. */
  private reserve = 0;
  /** Why this tick's final Hauler weight is 0 while a rock has a shortfall (DESIGN.md H8 change 1 amendment): 'limit' (a), 'recycling' (b), or null. */
  haulerBlock: 'limit' | 'recycling' | null = null;
  /** The economy ships plus the reserve while haulerBlock is 'limit' (for tests: (a) says it is at least the fleet limit). */
  blockLoad = 0;
  private readonly backstops: Backstops;
  respond: boolean;
  constructor(private readonly opts: AdaptiveOptions, backstops?: Backstops) {
    this.backstops = backstops ?? new Backstops(opts.dronesOnly);
    this.respond = opts.respond;
  }

  decide(world: Readonly<World>, data: SimData): Input[] {
    const heart = heartIndex(world);
    this.shrinking = false;
    this.waveTotal = 0;
    this.reserve = 0;
    this.haulerBlock = null;
    const rs = raidStatus(world);
    const raid = rs.phase === 'none' ? null : rs;
    const parked = parkedWarships(world);
    if (!this.offence && this.opts.offenceGate(world, data)) this.offence = true;

    // Bookkeeping: the last raid's size, mix and target (the standing guard).
    if (raid !== null && raid.target !== null) {
      this.lastPlanned = raid.planned.thorn + raid.planned.spore;
      this.lastRaidMix = { ...raid.planned };
      this.standAt = raid.target;
    }
    const raidActive = this.respond && raid !== null && raid.target !== null;
    const limit = searchMax(world, data);
    const w: Weights = { ...ZERO, ...economyWeights(world, data, this.offence) };
    const types = unlockedWarships(world, this.opts.dronesOnly);
    const hiveNow = guardsAtHome(world, heart);
    const hiveMix = this.offence ? waveFor(world, data, heart, types, limit, hiveNow) : null;
    const room = warshipRoom(world, data, limit);

    // Where the warships gather: the raid's target while answering one, the standing post otherwise.
    const stage = raidActive ? raid.target! : this.respond && this.standAt !== PROBE && world.field!.mine[this.standAt] === true ? this.standAt : PROBE;
    const inputs: Input[] = [];
    if (this.rally !== stage) {
      inputs.push({ type: 'setRally', node: stage });
      this.rally = stage;
    }
    const here = parked.get(stage) ?? EMPTY;
    const fit = soundShips(world, stage);
    /** Every branch ends here: the trade in slots in offence, then the weights. */
    const finish = (extra: Input[]): Input[] => {
      this.limitEconomy(world, data, w, types, limit);
      this.backstops.apply(world, data, w);
      if (w.hauler === 0 && haulerShortfall(world) > 0) {
        this.haulerBlock = this.shrinking ? 'recycling' : 'limit';
        const e = econCounts(world, data);
        this.blockLoad = e.extractor + e.hauler + Math.max(this.reserve, this.waveTotal);
      }
      return [...inputs, ...extra, ...weightInputs(world, data, w)];
    };

    // 1. Offence first when the hive can be taken right now (the raid window included: raiders away shrink hiveNow).
    if (this.offence && isGuarded(world, heart) && hiveMix !== null && covers(fit, hiveMix.fleet) && guardianAt(world, heart)!.battle === null && raid?.phase !== 'fight') {
      Object.assign(w, deficitWeights(world, data, hiveMix.fleet));
      return finish([sendInput(stage, heart, here)]);
    }

    if (raidActive) {
      // 2. Answer the raid: the counter for its majority at full weight until the defence matches it, sent to the target.
      const counter = counterFor(world, raid.planned, this.opts.dronesOnly);
      const defenders = world.ships.length;
      if (defenders < raid.planned.thorn + raid.planned.spore) w[counter] = world.tun['alloc.maxWeight'];
      return finish(regroup(world, parked, stage));
    }

    // 3. Counter pocket (the hive's majority counter), once offence has started or a raid has been answered.
    const counter = hiveCounter(world);
    if (!this.opts.dronesOnly && counter.pocket !== null && !isTypeUnlocked(world, counter.type) && (this.offence || (this.respond && rs.last !== null))) {
      const extra = this.pocketAssault(world, data, counter.pocket, w, fit, stage, limit, room);
      if (extra !== null) return finish([...extra, ...regroup(world, parked, stage)]);
    }

    if (this.offence && isGuarded(world, heart)) {
      // 4. Build for the hive: the wave for its strength now when it fits the room; else for the raid window (the
      // hive with a full-size raid away), and wait there for a raid to go out.
      let plan = hiveMix !== null && hiveMix.total <= room ? hiveMix : null;
      if (plan === null) {
        const away = raidAwayAtEcon(world, heart, econAliveNow(world, data)).home;
        const m = waveFor(world, data, heart, types, limit, away);
        if (m !== null && m.total <= room && rs.enabled) plan = m;
      }
      const extra: Input[] = regroup(world, parked, stage);
      if (plan !== null) {
        this.waveTotal = plan.total;
        Object.assign(w, deficitWeights(world, data, plan.fleet));
        // The fleet is full of ships the plan can't use (wounded, or a type it doesn't need): scrap one to open a slot.
        const missing = w.drone + w.lancer + w.flak > 0;
        const r = missing && isFleetFull(world, data) ? this.recycleUnfit(world, data, plan.fleet) : null;
        if (r !== null) extra.push(r);
      } else if (!this.opts.dronesOnly && this.lockedTaken(world).length > 0) {
        // Not a dead end: a pocket is taken and its first delivery, which unlocks its type, is on the way.
      } else {
        // The dead end (the Director's rule): no hive plan fits fleetCap minus the economy. A player can (a) take
        // the other pocket if that unlocks a mix that fits, else (b) Recycle economy ships until the wave fits.
        // `drones-only` has no plan that fits by design (flag 5) and no other pocket: as a control it keeps building drones up to the limit (DESIGN.md H8 table).
        if (this.opts.dronesOnly) w.drone = world.tun['alloc.maxWeight'];
        const other = this.otherPocket(world, data, counter, types, limit);
        const e = other === null ? null : this.pocketAssault(world, data, other, w, fit, stage, limit, room);
        if (e !== null) extra.push(...e);
        else {
          const r = this.recycleStep(world, data, types, limit, room);
          if (r !== null) extra.push(r);
        }
      }
      return finish(extra);
    }

    // 5. The standing guard: half the last raid, counter type for it, until there is that many.
    if (this.respond && this.lastPlanned > 0) {
      const guard = Math.ceil(this.lastPlanned / 2);
      if (total(here) < guard) w[counterFor(world, this.lastRaidMix, this.opts.dronesOnly)] = world.tun['alloc.maxWeight'];
    }
    return finish(regroup(world, parked, stage));
  }

  /**
   * Assault a pocket with drones: weights toward its (raised) min-wave, and once the sound ships at the stage cover
   * it, send exactly those (exactSend). When the wave doesn't fit the room, in offence the pocket is still the plan
   * if the wave plus the economy floor fits the limit (the Director's rule, extended in round 3): the economy stops
   * growing and Recycles down toward the wave, as for the hive. Null when the pocket can't be the plan.
   */
  private pocketAssault(world: Readonly<World>, data: SimData, node: number, w: Weights, fit: ShipTypeCounts, stage: number, limit: number, room: number): Input[] | null {
    if (!isGuarded(world, node)) return null;
    // A wave on its way or fighting there is committed: no new plan (its own order already raised wavesSent).
    if (guardianAt(world, node)!.battle !== null || world.ships.some((s) => s.transit !== null && s.transit.to === node)) return [];
    const mix = waveFor(world, data, node, ['drone'], limit, guardsAtHome(world, node));
    if (mix === null) return null;
    this.waveTotal = mix.total;
    const cap = fleetCap(world, data);
    const counted = cap !== null && world.tun['fleet.countsEconomy'] >= 1;
    if (mix.total > room) {
      if (!this.offence || !counted || mix.total + this.econFloor(world) > cap) return null;
      w.extractor = 0;
      w.hauler = 0;
      Object.assign(w, deficitWeights(world, data, mix.fleet));
      const r = this.recycleEconToward(world, data, mix.total, room);
      return r === null ? [] : [r];
    }
    // The pocket's own trade in slots: in offence the economy stops growing while one more ship would leave the wave no room.
    if (this.offence && counted && econAliveNow(world, data) + ECON_MARGIN + mix.total > cap) {
      w.extractor = 0;
      w.hauler = 0;
    }
    Object.assign(w, deficitWeights(world, data, mix.fleet));
    if (covers(fit, mix.fleet)) return exactSend(world, stage, node, mix.fleet);
    // Full of ships this wave can't use (wounded, or other types): scrap one to open a slot.
    const r = w.drone + w.lancer + w.flak > 0 && isFleetFull(world, data) ? this.recycleUnfit(world, data, mix.fleet) : null;
    return r === null ? [] : [r];
  }

  /**
   * (a) of the dead end: the other pocket, when its type is locked and unlocking it gives a hive mix that fits the
   * fleet limit with the economy at its floor.
   */
  private otherPocket(world: Readonly<World>, data: SimData, counter: { type: 'lancer' | 'flak'; pocket: number | null }, types: readonly ShipType[], limit: number): number | null {
    if (this.opts.dronesOnly) return null;
    const otherType = counter.type === 'flak' ? 'lancer' : 'flak';
    const node = pocketOf(world, otherType);
    const cap = fleetCap(world, data);
    if (node === null || cap === null || !isGuarded(world, node) || isTypeUnlocked(world, otherType)) return null;
    const m = this.smallestHiveWave(world, data, [...types, otherType], limit);
    return m !== null && m + this.econFloor(world) <= cap ? node : null;
  }

  /** The smallest hive wave over the hive as it is and, when raids are on, with a full-size raid away. */
  private smallestHiveWave(world: Readonly<World>, data: SimData, types: readonly ShipType[], limit: number): number | null {
    const heart = heartIndex(world);
    const totals: number[] = [];
    const now = waveFor(world, data, heart, types, limit, guardsAtHome(world, heart));
    if (now !== null) totals.push(now.total);
    if (raidStatus(world).enabled) {
      const away = waveFor(world, data, heart, types, limit, raidAwayAtEcon(world, heart, econAliveNow(world, data)).home);
      if (away !== null) totals.push(away.total);
    }
    return totals.length === 0 ? null : Math.min(...totals);
  }

  /** The economy the wave still needs to be paid for: raid.firstAtEcon ships (the size below which raids stop and the first income runs). */
  private econFloor(world: Readonly<World>): number {
    return world.tun['raid.firstAtEcon'];
  }

  /**
   * (b) of the dead end: one Recycle order, worst-placed economy ship first (idle at the probe, then the most
   * exposed rocks, nearest the hive, then the lowest yield; haulers before extractors), while the smallest hive wave
   * does not fit the room and the economy stays above its floor. Null when nothing needs to or can be recycled.
   */
  private recycleStep(world: Readonly<World>, data: SimData, types: readonly ShipType[], limit: number, room: number): Input | null {
    const target = this.smallestHiveWave(world, data, types, limit);
    return target === null ? null : this.recycleEconToward(world, data, target, room);
  }

  /**
   * One Recycle order toward a wave of `need` ships (the hive's, or round 3: a pocket's that is the plan), worst-placed
   * economy ship first, while `need` exceeds the room, the floor leaves room for it (need + floor ≤ the limit), and
   * the economy is above the floor. One order per RECYCLE_EVERY ticks. Null when nothing needs to or can go.
   */
  private recycleEconToward(world: Readonly<World>, data: SimData, need: number, room: number): Input | null {
    const cap = fleetCap(world, data);
    if (cap === null || world.tun['fleet.countsEconomy'] < 1) return null;
    const floor = this.econFloor(world);
    if (need <= room || need + floor > cap || econAliveNow(world, data) <= floor) return null;
    this.shrinking = true;
    if (world.tick % RECYCLE_EVERY !== 0) return null;
    const heart = heartIndex(world);
    const nodes = world.nodes
      .filter((n) => !isGuarded(world, n.index))
      .map((n) => ({ node: n.index, probe: n.kind === 'probe' ? 0 : 1, dist: nodeDistance(world, n.index, heart), yield: n.kind === 'probe' ? 0 : rockStatus(world, n.index).deliveredPerMin }))
      .sort((a, b) => a.probe - b.probe || a.dist - b.dist || a.yield - b.yield || a.node - b.node);
    for (const n of nodes) {
      const at = econAtByType(world, n.node);
      for (const type of ['hauler', 'extractor'] as const) {
        if (at[type] === 0) continue;
        const input: Input = { type: 'recycleShips', node: n.node, counts: { drone: 0, lancer: 0, flak: 0, extractor: type === 'extractor' ? 1 : 0, hauler: type === 'hauler' ? 1 : 0 } };
        if (isValidInput(world, data, input)) return input;
      }
    }
    return null;
  }

  /**
   * One Recycle order for a warship the plan cannot use, parked away from a living guard: a wounded one (hp under
   * half, so the estimate can't count it), else one of a type the plan has more of than it needs. It holds a slot.
   */
  private recycleUnfit(world: Readonly<World>, data: SimData, need: Readonly<ShipTypeCounts>): Input | null {
    if (world.tick % RECYCLE_EVERY !== 0) return null;
    const sound = soundShips(world);
    const pick = (s: World['ships'][number]): boolean => s.hp * 2 < world.tun[`ship.${s.type}.hp`] || sound[s.type] > need[s.type];
    for (const s of world.ships) {
      if (s.at === null || s.transit !== null || !pick(s)) continue;
      const input: Input = { type: 'recycleShips', node: s.at, counts: { drone: s.type === 'drone' ? 1 : 0, lancer: s.type === 'lancer' ? 1 : 0, flak: s.type === 'flak' ? 1 : 0, extractor: 0, hauler: 0 } };
      if (isValidInput(world, data, input)) return input;
    }
    return null;
  }

  /** The pockets that are taken but whose type is still locked (no delivery from them yet). */
  private lockedTaken(world: Readonly<World>): number[] {
    const out: number[] = [];
    for (const type of ['flak', 'lancer'] as const) {
      const node = pocketOf(world, type);
      if (node !== null && !isGuarded(world, node) && !isTypeUnlocked(world, type)) out.push(node);
    }
    return out;
  }

  /**
   * The trade in slots: in offence the economy grows only while one more ship still leaves the fleet limit room
   * for the smallest hive wave (the hive as it is now, or with a full-size raid away when raids are on, the
   * counter included). It never stops the one hauler a taken pocket still lacks: its deliveries pay for
   * Lancers and Flak, and the first one unlocks the type.
   */
  private limitEconomy(world: Readonly<World>, data: SimData, w: Weights, types: readonly ShipType[], limit: number): void {
    const cap = fleetCap(world, data);
    if (!this.offence || cap === null || world.tun['fleet.countsEconomy'] < 1) return;
    const counter = hiveCounter(world);
    const withCounter = this.opts.dronesOnly || types.includes(counter.type) ? types : [...types, counter.type];
    const smallest = this.smallestHiveWave(world, data, withCounter, limit);
    const e = econCounts(world, data);
    this.reserve = smallest ?? 0;
    if (smallest !== null && e.extractor + e.hauler + ECON_MARGIN + smallest <= cap) return;
    w.extractor = 0;
    w.hauler = 0;
    // While economy ships are being Recycled toward a wave, only a taken pocket with no hauler yields one back (its
    // first delivery unlocks its type): building haulers the plan is recycling would thrash.
    if (this.shrinking) {
      if (this.opts.dronesOnly) return;
      for (const node of world.nodes) if (node.kind === 'pocket' && !isGuarded(world, node.index) && rockStatus(world, node.index).haulers === 0) w.hauler = 1;
      return;
    }
    // H8 change 1: a rock with a shortfall gets its haulers; H4 stops the sim building more than the need. A taken
    // pocket always does (its deliveries pay for the type it unlocks). An asteroid does not into the room the wave
    // being built for needs: a hauler built there would only be Recycled again.
    if (haulerShortfall(world, 'pocket') > 0 || (haulerShortfall(world) > 0 && e.extractor + e.hauler + Math.max(smallest ?? 0, this.waveTotal) < cap)) w.hauler = 1;
  }
}

// ---- The strategies -------------------------------------------------------------------------------------------

const adaptiveOpts = (over: Partial<AdaptiveOptions> = {}): AdaptiveOptions => ({
  respond: true,
  dronesOnly: false,
  offenceGate: (w, d) => econAliveNow(w, d) >= OFFENCE_AT_ECON,
  ...over,
});

/**
 * `greedy`: all economy until every open slot has an extractor, no warships, no pocket, ignoring musters. After
 * its first raid that hits (`fieldSummary.raids.hit >= 1`) it plays `adaptive`'s rules for the rest of the run.
 */
class GreedyBot implements FieldBot {
  private inner: AdaptiveBot | null = null;
  private readonly backstops = new Backstops(false);
  get haulerBlock(): 'limit' | 'recycling' | null {
    return this.inner === null ? null : this.inner.haulerBlock;
  }
  get blockLoad(): number {
    return this.inner === null ? 0 : this.inner.blockLoad;
  }
  decide(world: Readonly<World>, data: SimData): Input[] {
    // The inner bot takes over greedy's backstops, so a wipe by the first hit is still recovered from.
    if (this.inner === null && fieldSummary(world).raids.hit >= 1) this.inner = new AdaptiveBot(adaptiveOpts(), this.backstops);
    if (this.inner !== null) return this.inner.decide(world, data);
    const w: Weights = { ...ZERO, ...economyWeights(world, data, false) };
    this.backstops.apply(world, data, w);
    return weightInputs(world, data, w);
  }
}

/** `idle`: holds econ at raid.firstAtEcon - 1, then builds warships only. */
class IdleBot implements FieldBot {
  decide(world: Readonly<World>, data: SimData): Input[] {
    const c = econCounts(world, data);
    // A full share starts its bay next tick, so it counts as built.
    const f = world.field!;
    const pending = (['extractor', 'hauler'] as const).filter((t) => f.bays[t].ticksLeft === 0 && f.share[t] > 0 && f.share[t] >= oreCost(world, t)).length;
    const hold = world.tun['raid.firstAtEcon'] - 1;
    const w: Weights = { ...ZERO };
    if (c.extractor + c.hauler + pending < hold) {
      w.extractor = world.tun['alloc.start.extractor'] || 3;
      w.hauler = world.tun['alloc.start.hauler'] || 2;
    } else w.drone = world.tun['alloc.maxWeight'];
    return weightInputs(world, data, w);
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
    const inputs = weightInputs(world, data, this.weights);
    const limit = searchMax(world, data);
    const parked = parkedWarships(world);
    const here = parked.get(PROBE) ?? EMPTY;
    const types = WARSHIPS.filter((t) => this.weights[t] > 0 && isTypeUnlocked(world, t));
    // The guarded nodes, the cheapest estimate first: attack the first one the ships at the probe can take.
    const rows: { node: number; mix: { total: number; fleet: ShipTypeCounts } }[] = [];
    for (const n of world.nodes) {
      if (!isGuarded(world, n.index) || guardianAt(world, n.index)!.battle !== null) continue;
      const m = waveFor(world, data, n.index, types, limit, guardsAtHome(world, n.index));
      if (m !== null) rows.push({ node: n.index, mix: m });
    }
    rows.sort((a, b) => a.mix.total - b.mix.total || a.node - b.node);
    for (const r of rows) {
      if (covers(soundShips(world, PROBE), r.mix.fleet)) {
        // The hive takes everything parked; a pocket takes exactly the sound ships the estimate counted.
        if (r.node === heartIndex(world)) inputs.push(sendInput(PROBE, r.node, here));
        else inputs.push(...exactSend(world, PROBE, r.node, r.mix.fleet));
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
  description: 'economy first; answers a muster with the counter type at the target; takes the counter pocket; offence at econ 12, attacking when the best mix fits, preferring a raid out; recycles or takes the other pocket when no plan fits',
  expectedWin: true,
  make: () => new AdaptiveBot(adaptiveOpts()),
};
export const greedy: FieldStrategy = {
  name: 'greedy',
  description: 'all economy until every open slot has an extractor, nothing else, ignores musters; after its first hit it plays adaptive',
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

/** The strategies the gate expects to win. */
export const FIELD_WINNERS: readonly string[] = ['adaptive', 'greedy'];
/** Every non-static strategy, in report order. */
export const fieldStrategies: readonly FieldStrategy[] = [adaptive, greedy, idle, dronesOnly, adaptiveNoRaids];
