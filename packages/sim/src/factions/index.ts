import { GUARD_TYPES, type GuardType, type SimData } from '../data.ts';
import { assignedHaulers, econAlive, isDocked, syncExtractors } from '../field.ts';
import { ceilDiv } from '../math.ts';
import { guardPools, guardStrike, playerDamage } from '../combat.ts';
import {
  PROBE,
  countGuards,
  fieldOf,
  guardCaps,
  guardRegrowTicks,
  guardianAt,
  heartIndex,
  isGuarded,
  nodeDistance,
  type EconShip,
  type EconTypeCounts,
  type Guard,
  type GuardCounts,
  type Guardian,
  type Ship,
  type ShipTypeCounts,
  type World,
} from '../world.ts';

/**
 * Faction AI (DESIGN.md H7 "Raids", R1–R9): the hive's raids. `step` calls `raidStep` at F8 (after movement,
 * before combat at guarded nodes); `hiveRegrow` replaces the hive's rule-9 regrowth in field mode (R9) and
 * `raidWither` is called when the hive is captured (F11). Everything here is integer-only with fixed orders and
 * no RNG, like the rest of the sim: the raiders are the hive's own guards, so a raid needs no randomness.
 */

/** R1: a raid's phase (`raidStatus.phase` summarises the prongs with these). */
export type RaidPhase = 'muster' | 'out' | 'fight' | 'home';

/** H9: a prong's phase (`done`: beaten, or home and rejoined the guard list; W6). */
export type ProngPhase = RaidPhase | 'done';

/** H9 W6: a prong's own outcome, once decided. */
export type ProngOutcome = 'beaten' | 'hit' | 'turnedBack';

/** How a raid ended (R8), or `withered` when the hive fell with the raid out (R9; not counted in the stats). */
export type RaidOutcome = 'beaten' | 'hit' | 'turnedBack' | 'withered';

/**
 * H9 W1-W6: one prong's state, the fields H7's single raid had, now per prong. A raid is its prong 0 (these fields on
 * the `Raid` itself) plus `Raid.others` (prongs 1 and up). So a one-prong raid has exactly H7/H8's shape and state
 * (W8), and every H8 test that builds a `Raid` by hand still does.
 */
export interface Prong {
  /** While mustering every prong is `muster`; afterwards each prong's own phase. */
  phase: ProngPhase;
  /** The node the prong is flying to or fighting at (R5), fixed at muster; W5 may retarget it once. While `home` it is the rock it left. */
  target: number;
  /** The prong's raiders, once launched (hive order). Empty while mustering (they stay in the hive's guard list) and once the prong is done. */
  guards: Guard[];
  /** Ticks left in the current phase (the muster countdown, kept on prong 0 only, or the flight). */
  ticksLeft: number;
  /** W2: the prong's share of the raid's size by type (the deal of the plan, then of the launched raiders). */
  planned: GuardCounts;
  /** The length of the current flight (out or home) in ticks, 0 while mustering or fighting (the client draws progress from it). */
  flightTicks: number;
  /** The node the current flight started from (the hive, or the rock the prong left or was retargeted from). */
  from: number;
  /** W5: this prong has already retargeted once. */
  retargeted: boolean;
  /** What the prong has done so far (its outcome and `last.prongs` read these). */
  lostEcon: EconTypeCounts;
  lostShips: ShipTypeCounts;
  killed: GuardCounts;
  /** Set when the prong is `done` (W6), never before: until then the outcome is derived (`prongOutcome`). */
  outcome?: ProngOutcome;
}

/**
 * R1 / H9: the raid in progress (`world.raid`), or none (null). One raid with one muster and one gap: prong 0 is the
 * raid's own fields and `others` holds prongs 1 and up (absent for a one-prong raid, which is H8's shape). Walk them
 * all with `raidProngs`.
 */
export interface Raid extends Prong {
  id: number;
  others?: Prong[];
}

/** H9: the raid's prongs in prong order (prong 0 is the raid itself). */
export function raidProngs(raid: Readonly<Raid>): Prong[] {
  return [raid as Prong, ...(raid.others ?? [])];
}

/** H9: one prong's part of a finished raid (`RaidResult.prongs`). */
export interface ProngResult {
  target: number;
  /** The prong's own outcome (W6), or `withered` when the hive fell with it out (R9). */
  outcome: RaidOutcome;
  lostEcon: EconTypeCounts;
  lostShips: ShipTypeCounts;
  killed: GuardCounts;
}

/** What a finished raid did (`world.lastRaid`, `raidStatus().last`). */
export interface RaidResult {
  id: number;
  outcome: RaidOutcome;
  /** The node it hit (or was last flying to). */
  target: number;
  endTick: number;
  /** Economy ships and warships the raid killed, and raiders the defenders killed. */
  lostEcon: EconTypeCounts;
  lostShips: ShipTypeCounts;
  killed: GuardCounts;
  /**
   * H9: each prong's result, in prong order. `outcome` above is W6's overall outcome and `target` is prong 0's.
   * h9-sim stub: one prong mirroring the single raid (h9-raids fills it per prong).
   */
  prongs: ProngResult[];
}

/** The hive's guardian (the heart), or null in a world without one. */
function hiveOf(world: Readonly<World>): Guardian | null {
  return guardianAt(world, heartIndex(world));
}

/**
 * R5: a node a raid may target: the field's asteroids and captured pockets that are Mine-marked and have at
 * least one docked extractor ship or one assigned hauler. The mark is required (decided in h7-raids, DECISIONS.md:
 * Stop must take a rock off the raid list), so a hauler flying home from a Stopped rock, which keeps the rock as
 * its target until it reaches the probe, does not make it a target. Free extractors don't count (the spec names
 * docked extractors and haulers). Never the probe, never the hive.
 */
export function isRaidable(world: Readonly<World>, node: number, assigned: readonly number[] = assignedHaulers(world)): boolean {
  const f = world.field;
  if (f === null || node === PROBE) return false;
  const kind = world.nodes[node]!.kind;
  if (kind !== 'asteroid' && kind !== 'pocket') return false;
  if (f.mine[node] !== true || isGuarded(world, node)) return false;
  if (assigned[node]! > 0) return true;
  for (const s of f.econ) if (isDocked(s) && s.at === node) return true;
  return false;
}

/** The raidable nodes, nearest the hive first, ties to the lower index. */
function raidables(world: Readonly<World>): number[] {
  const hive = heartIndex(world);
  const assigned = assignedHaulers(world);
  const out: number[] = [];
  for (const n of world.nodes) if (isRaidable(world, n.index, assigned)) out.push(n.index);
  const d = (n: number): number => nodeDistance(world, hive, n);
  return out.sort((a, b) => d(a) - d(b) || a - b);
}

/** R5: the target: the raidable node nearest the hive (ties to the lower index), or null. */
export function raidTarget(world: Readonly<World>): number | null {
  return raidables(world)[0] ?? null;
}

/** `rockStatus.raidRank`: the 1-based position among the raidable nodes by distance to the hive (1 is the R5 target); 0 if the rock is not raidable. */
export function raidRank(world: Readonly<World>, node: number): number {
  if (world.field === null) return 0;
  return raidables(world).indexOf(node) + 1;
}

/** R4: the keep: ceil((thorn cap + spore cap) × raid.hiveKeepPct ÷ 100), the caps after guard.capPct. */
export function raidKeep(world: Readonly<World>, hive: Readonly<Guardian>): number {
  const caps = guardCaps(world, hive);
  return ceilDiv((caps.thorn + caps.spore) * world.tun['raid.hiveKeepPct'], 100);
}

/**
 * R4: the mix of `size` raiders from a hive holding `alive` guards: thorn = floor(size × thornsAlive ÷ guardsAlive),
 * spore = the rest. A type that runs short is made up by the other (never more than is alive of either).
 */
export function raidMix(size: number, alive: Readonly<GuardCounts>): GuardCounts {
  const total = alive.thorn + alive.spore;
  if (total === 0 || size <= 0) return { thorn: 0, spore: 0 };
  let thorn = Math.floor((size * alive.thorn) / total);
  let spore = size - thorn;
  if (spore > alive.spore) {
    thorn += spore - alive.spore;
    spore = alive.spore;
  }
  if (thorn > alive.thorn) {
    spore += thorn - alive.thorn;
    thorn = alive.thorn;
  }
  return { thorn: Math.min(thorn, alive.thorn), spore: Math.min(spore, alive.spore) };
}

/** R4: the planned size of the next raid from `econ`, the tunables and the hive's guards (0 if the hive can't spare any). */
export function raidSize(world: Readonly<World>, econ: number, hive: Readonly<Guardian>): number {
  const t = world.tun;
  const want = Math.min(t['raid.maxSize'], ceilDiv(econ, t['raid.econPerRaider']));
  return Math.min(want, Math.max(0, hive.guards.length - raidKeep(world, hive)));
}

/**
 * R6: who actually leaves at the launch: the planned mix, each type capped at what's alive, a shortfall made up by
 * the other type, and the total capped at `spare` (the guards alive above the keep; spores are trimmed first).
 */
export function launchMix(planned: Readonly<GuardCounts>, alive: Readonly<GuardCounts>, spare: number): GuardCounts {
  const want = Math.min(planned.thorn + planned.spore, spare);
  let thorn = Math.min(planned.thorn, alive.thorn);
  let spore = Math.min(planned.spore, alive.spore);
  let need = want - thorn - spore;
  if (need > 0) {
    const s = Math.min(need, alive.spore - spore);
    spore += s;
    need -= s;
    thorn += Math.min(need, alive.thorn - thorn);
  }
  let over = thorn + spore - want;
  if (over > 0) {
    const s = Math.min(over, spore);
    spore -= s;
    over -= s;
    thorn -= over;
  }
  return { thorn, spore };
}

const zeroEcon = (): EconTypeCounts => ({ extractor: 0, hauler: 0 });
const zeroShips = (): ShipTypeCounts => ({ drone: 0, lancer: 0, flak: 0 });
const zeroGuards = (): GuardCounts => ({ thorn: 0, spore: 0 });

function countOf(guards: readonly Guard[]): GuardCounts {
  const c = zeroGuards();
  for (const g of guards) c[g.type] += 1;
  return c;
}

/** Raiders away from the hive, by type, across every prong (W7). */
function raidersOut(world: Readonly<World>): GuardCounts {
  const c = zeroGuards();
  if (world.raid !== null) for (const p of raidProngs(world.raid)) for (const g of p.guards) c[g.type] += 1;
  return c;
}

/** True if the prong has killed an economy ship (W6: `hit`). */
const hurt = (p: Readonly<Prong>): boolean => p.lostEcon.extractor + p.lostEcon.hauler > 0;

/** W6: the prong's outcome: null until decided; decided when it is beaten or leaves its target (so from `home`). */
export function prongOutcome(p: Readonly<Prong>): ProngOutcome | null {
  if (p.phase === 'done') return p.outcome ?? null;
  if (p.phase === 'home') return hurt(p) ? 'hit' : 'turnedBack';
  return null;
}

/** W1: how many prongs a raid of `size` raiders has with `k` raidable nodes: min(prongsMax, k, max(1, floor(size ÷ prongMinSize))). */
export function prongCount(world: Readonly<World>, k: number, size: number): number {
  const t = world.tun;
  return Math.min(t['raid.prongsMax'], k, Math.max(1, Math.floor(size / t['raid.prongMinSize'])));
}

/**
 * W2: the plan's deal. Raiders go to the prongs one at a time by a single pointer that starts at prong 0 and cycles,
 * Thorns first, then Spores, without resetting it. So 4T 8S in 2 prongs is 2T 4S each, and 3T 8S is 2T 4S and 1T 4S:
 * the nearest rock never gets the smaller prong.
 */
export function dealCounts(mix: Readonly<GuardCounts>, prongs: number): GuardCounts[] {
  const out: GuardCounts[] = Array.from({ length: prongs }, zeroGuards);
  let p = 0;
  for (const type of GUARD_TYPES) {
    for (let i = 0; i < mix[type]; i++) {
      out[p]![type] += 1;
      p = (p + 1) % prongs;
    }
  }
  return out;
}

/** W2: the launched raiders dealt by the same pointer (Thorns first, each type in the order given: lowest id first). Each prong's list keeps the given (hive) order. */
function dealGuards(taken: readonly Guard[], prongs: number): Guard[][] {
  const to = new Map<Guard, number>();
  let p = 0;
  for (const type of GUARD_TYPES) {
    for (const g of taken) {
      if (g.type !== type) continue;
      to.set(g, p);
      p = (p + 1) % prongs;
    }
  }
  const lists: Guard[][] = Array.from({ length: prongs }, () => []);
  for (const g of taken) lists[to.get(g)!]!.push(g);
  return lists;
}

/** W6: the raid's overall outcome: hit if any prong hit, else beaten if every prong was beaten, else turned back. */
function overallOutcome(prongs: readonly Prong[]): Exclude<RaidOutcome, 'withered'> {
  if (prongs.some((p) => p.outcome === 'hit')) return 'hit';
  if (prongs.every((p) => p.outcome === 'beaten')) return 'beaten';
  return 'turnedBack';
}

function finish(world: World, outcome: RaidOutcome): void {
  const r = world.raid!;
  const list = raidProngs(r);
  const lostEcon = zeroEcon();
  const lostShips = zeroShips();
  const killed = zeroGuards();
  for (const p of list) {
    lostEcon.extractor += p.lostEcon.extractor;
    lostEcon.hauler += p.lostEcon.hauler;
    for (const t of ['drone', 'lancer', 'flak'] as const) lostShips[t] += p.lostShips[t];
    killed.thorn += p.killed.thorn;
    killed.spore += p.killed.spore;
  }
  world.lastRaid = {
    id: r.id,
    outcome,
    target: r.target,
    endTick: world.tick,
    lostEcon,
    lostShips,
    killed,
    // A prong the hive's fall caught (not done) withered (W6, R9).
    prongs: list.map((p) => ({
      target: p.target,
      outcome: p.phase === 'done' && p.outcome !== undefined ? p.outcome : 'withered',
      lostEcon: { ...p.lostEcon },
      lostShips: { ...p.lostShips },
      killed: { ...p.killed },
    })),
  };
  world.raid = null;
}

/** W6 / R8: every prong is done: count the raid by its overall outcome and each prong by its own, and start the gap from now. */
function endRaid(world: World): void {
  const list = raidProngs(world.raid!);
  const outcome = overallOutcome(list);
  const st = world.stats.raids;
  if (outcome === 'beaten') st.beaten += 1;
  else if (outcome === 'hit') st.hit += 1;
  else st.turnedBack += 1;
  for (const p of list) world.stats.raidProngs[p.outcome!] += 1;
  finish(world, outcome);
  world.nextRaidTick = world.tick + world.tun['raid.gapTicks'];
}

/** W6: a prong is done with `outcome` (its raiders already home or dead); the raid ends when every prong is. */
function prongDone(world: World, prong: Prong, outcome: ProngOutcome): void {
  prong.phase = 'done';
  prong.outcome = outcome;
  prong.guards = [];
  if (raidProngs(world.raid!).every((p) => p.phase === 'done')) endRaid(world);
}

/** R3: a raid musters when every condition holds. W1 then fixes its prongs. */
function tryMuster(world: World): void {
  const t = world.tun;
  const hive = hiveOf(world);
  if (t['raid.enabled'] !== 1 || hive === null || !hive.alive || world.raid !== null || world.tick < world.nextRaidTick) return;
  const econ = econAlive(world);
  if (econ < t['raid.firstAtEcon'] || hive.battle !== null) return;
  const nodes = raidables(world);
  if (nodes.length === 0) return;
  const size = raidSize(world, econ, hive);
  if (size < 1) return;
  world.stats.raids.mustered += 1;
  const plans = dealCounts(raidMix(size, countGuards(hive)), prongCount(world, nodes.length, size));
  const prongs: Prong[] = plans.map((planned, i) => ({
    phase: 'muster',
    target: nodes[i]!,
    guards: [],
    ticksLeft: 0,
    planned,
    flightTicks: 0,
    from: heartIndex(world),
    retargeted: false,
    lostEcon: zeroEcon(),
    lostShips: zeroShips(),
    killed: zeroGuards(),
  }));
  prongs[0]!.ticksLeft = t['raid.musterTicks'];
  const [first, ...others] = prongs;
  world.raid = { id: world.stats.raids.mustered, ...first!, ...(others.length > 0 ? { others } : {}) };
}

function startFlight(world: World, prong: Prong, from: number, to: number): void {
  prong.from = from;
  prong.flightTicks = ceilDiv(nodeDistance(world, from, to), world.tun['raid.speedSu']);
  prong.ticksLeft = prong.flightTicks;
}

function goHome(world: World, prong: Prong): void {
  prong.phase = 'home';
  startFlight(world, prong, prong.target, heartIndex(world));
}

/** R6: the muster countdown, then the launch (W2: the raiders are dealt again, and the prongs may drop to fewer). A battle at the hive cancels it. */
function muster(world: World, raid: Raid, hive: Guardian): void {
  if (hive.battle !== null) {
    world.raid = null;
    world.nextRaidTick = world.tick;
    return;
  }
  if (raid.ticksLeft > 0) raid.ticksLeft -= 1;
  if (raid.ticksLeft > 0) return;
  // Launch: the planned raiders, lowest id of each type first, capped at what's alive above the keep.
  const prongs = raidProngs(raid);
  const plan = zeroGuards();
  for (const p of prongs) {
    plan.thorn += p.planned.thorn;
    plan.spore += p.planned.spore;
  }
  const spare = Math.max(0, hive.guards.length - raidKeep(world, hive));
  const take = launchMix(plan, countGuards(hive), spare);
  if (take.thorn + take.spore < 1) {
    world.raid = null;
    world.nextRaidTick = world.tick;
    return;
  }
  const left: Guard[] = [];
  const taken: Guard[] = [];
  const need: GuardCounts = { ...take };
  for (const g of hive.guards) {
    if (need[g.type] > 0) {
      need[g.type] -= 1;
      taken.push(g);
    } else left.push(g);
  }
  hive.guards = left;
  // W2: the prong count is recomputed from the launched size, keeping the nearest targets.
  const n = Math.min(prongs.length, Math.max(1, Math.floor(taken.length / world.tun['raid.prongMinSize'])));
  const lists = dealGuards(taken, n);
  for (let i = 0; i < n; i++) {
    const p = prongs[i]!;
    p.guards = lists[i]!;
    p.planned = countOf(p.guards);
    p.phase = 'out';
    startFlight(world, p, heartIndex(world), p.target);
  }
  if (n > 1) raid.others = prongs.slice(1, n);
  else delete raid.others;
}

/** W5: where a prong retargets: the nearest raidable node in hive order that no other prong in `out` or `fight` aims at, or null. */
function retargetNode(world: Readonly<World>, raid: Readonly<Raid>, prong: Readonly<Prong>): number | null {
  const live = raidProngs(raid).filter((p) => p !== prong && (p.phase === 'out' || p.phase === 'fight'));
  return raidables(world).find((n) => !live.some((p) => p.target === n)) ?? null;
}

/** R6 / W5: arrival at the target; if it is no longer raidable the prong retargets once, or flies home. */
function arrive(world: World, raid: Raid, prong: Prong): void {
  if (isRaidable(world, prong.target)) {
    prong.phase = 'fight';
    prong.from = prong.target;
    prong.flightTicks = 0;
    return;
  }
  const next = prong.retargeted ? null : retargetNode(world, raid, prong);
  if (next === null) {
    goHome(world, prong);
    return;
  }
  prong.retargeted = true;
  const from = prong.target;
  prong.target = next;
  startFlight(world, prong, from, next);
}

/** R7 / W4: one round at the prong's own target. */
function fight(world: World, prong: Prong): void {
  if (world.tick % world.tun['combat.roundTicks'] !== 0) return;
  const f = fieldOf(world);
  const warships: Ship[] = world.ships.filter((s) => s.at === prong.target);
  const econ: EconShip[] = f.econ.filter((s) => s.at === prong.target);
  if (warships.length === 0 && econ.length === 0) {
    goHome(world, prong);
    return;
  }
  const byType = { drone: 0, lancer: 0, flak: 0 };
  for (const s of warships) byType[s.type] += 1;
  // Both sides strike from the start-of-round state: the pools are sized before the warships' damage lands.
  const pools = guardPools(world.tun, prong.guards);
  playerDamage(world.tun, prong.guards, byType);
  // H9: with a warship at the node when the round starts, the raiders strike warships only and the overflow is lost.
  const shielded = world.tun['raid.shieldEcon'] === 1 && warships.length > 0;
  const kills = guardStrike(pools, warships, shielded ? [] : econ);
  for (const s of kills.ships) {
    prong.lostShips[s.type] += 1;
    world.stats.shipsLost[s.type] += 1;
  }
  for (const s of kills.econ) {
    prong.lostEcon[s.type] += 1;
    world.stats.econLost[s.type] += 1;
  }
  if (kills.ships.length > 0) world.ships = world.ships.filter((s) => s.hp > 0);
  if (kills.econ.length > 0) {
    f.econ = f.econ.filter((s) => s.hp > 0);
    // A docked extractor may have died: the node's extractors count drops this tick.
    syncExtractors(world);
  }
  for (const g of prong.guards) {
    if (g.hp > 0) continue;
    prong.killed[g.type] += 1;
    world.stats.guardsKilled[g.type] += 1;
  }
  prong.guards = prong.guards.filter((g) => g.hp > 0);
  if (prong.guards.length === 0) prongDone(world, prong, 'beaten');
}

/** R8: the prong's raiders reach the hive and rejoin its guard list (ascending id), with their hp and ids. */
function returnHome(world: World, prong: Prong, hive: Guardian): void {
  hive.guards = [...hive.guards, ...prong.guards].sort((a, b) => a.id - b.id);
  prongDone(world, prong, hurt(prong) ? 'hit' : 'turnedBack');
}

/**
 * F8, the raid hook. Called once per field-mode tick, after movement (F7) and before combat at guarded nodes
 * (F10). Muster (R3, W1), launch (R6, W2), then each prong in prong order: the fight (R7), arrival (W5) and the return
 * (R8). The hive's regrowth with raiders out is `hiveRegrow` (R9) and the withering at capture is `raidWither`. After
 * removing a docked extractor it calls `syncExtractors` so the node's `extractors` count drops the same tick.
 */
export function raidStep(world: World, data: SimData): void {
  void data;
  if (world.field === null) return;
  if (world.raid === null) tryMuster(world);
  const raid = world.raid;
  const hive = hiveOf(world);
  if (raid === null || hive === null) return;
  if (raid.phase === 'muster') {
    muster(world, raid, hive);
    return;
  }
  for (const p of raidProngs(raid)) {
    if (world.raid !== raid) return;
    if (p.phase === 'fight') {
      fight(world, p);
      continue;
    }
    if (p.phase !== 'out' && p.phase !== 'home') continue;
    // Out or home: fly.
    p.ticksLeft -= 1;
    if (p.ticksLeft > 0) continue;
    if (p.phase === 'out') arrive(world, raid, p);
    else returnHome(world, p, hive);
  }
}

/**
 * R9: rule 9 for the hive in field mode. The raiders away count against its caps, so only guards that died
 * regrow, and the period is guard.<type>.regrowTicks × hive.regrowPct ÷ 100 (floored, at least 1 tick).
 */
export function hiveRegrow(world: World, g: Guardian, add: (type: GuardType) => void): void {
  const caps = guardCaps(world, g);
  const count = countGuards(g);
  const out = raidersOut(world);
  const pct = world.tun['hive.regrowPct'];
  for (const type of GUARD_TYPES) {
    if (count[type] + out[type] >= caps[type]) {
      g.regrowProgress[type] = 0;
      continue;
    }
    g.regrowProgress[type] += 1;
    if (g.regrowProgress[type] >= Math.max(1, Math.floor((guardRegrowTicks(world, g, type) * pct) / 100))) {
      add(type);
      g.regrowProgress[type] = 0;
    }
  }
}

/** R9 / F11: the hive is captured: every raider is removed ("the raid withers") and raids end. */
export function raidWither(world: World): void {
  if (world.raid === null) return;
  finish(world, 'withered');
}

/**
 * DESIGN.md H8 H10 ("Haulers hold", `raid.haulersHold`) and H9 W4: true while haulers whose node is `node` hold for a
 * raid. `runHaulers` (F6) asks it for a hauler at the probe (true: it stays there and keeps its assignment) and for a
 * hauler at its node (true: it loads min(buffer, cargo) and leaves at once); a hauler flying out finishes its leg
 * and is then asked at the node. `rockStatus.haulersHeld` reads it too.
 *
 * True from launch (phase `out`) through the fight, for a prong's current target (W5's retarget moves it), when
 * raid.haulersHold is 1. Not during the muster, and false from the tick that prong's outcome is decided (it leaves the
 * target for home, or is beaten), whatever the outcome. It is per prong: a held rock's haulers resume while the other
 * prong still fights.
 */
export function haulersHeld(world: Readonly<World>, node: number): boolean {
  const r = world.raid;
  if (r === null || world.tun['raid.haulersHold'] !== 1) return false;
  return raidProngs(r).some((p) => (p.phase === 'out' || p.phase === 'fight') && p.target === node);
}

/** `rockStatus.raidTarget`: true from muster until the rock's prong is done (W6), for the node it targets (R5/W5). */
export function isRaidTargetNode(world: Readonly<World>, node: number): boolean {
  return world.raid !== null && raidProngs(world.raid).some((p) => p.phase !== 'done' && p.target === node);
}

/** H9 W4: true if a prong of the raid is in its `fight` phase at `node` (`recycleFleet` leaves those ships alone). */
export function raidFightsAt(world: Readonly<World>, node: number): boolean {
  return world.raid !== null && raidProngs(world.raid).some((p) => p.phase === 'fight' && p.target === node);
}

/** The haulers H10 holds now for `node`: waiting at the probe with it as their target. */
function haulersWaitingFor(world: Readonly<World>, node: number): number {
  const f = world.field;
  if (f === null) return 0;
  let n = 0;
  for (const s of f.econ) if (s.type === 'hauler' && s.transit === null && s.at === PROBE && s.target === node) n += 1;
  return n;
}

/** `raidStatus.holding`: the haulers H10 holds now, waiting at the probe with a held node as their target. */
function haulersHolding(world: Readonly<World>): number {
  const f = world.field;
  if (f === null || world.raid === null) return 0;
  let n = 0;
  for (const s of f.econ) {
    if (s.type === 'hauler' && s.transit === null && s.at === PROBE && s.target !== null && haulersHeld(world, s.target)) n += 1;
  }
  return n;
}

/** H9: one prong of the raid in progress (`raidStatus.prongs`, DESIGN.md H9 "Selectors"). */
export interface ProngStatus {
  target: number;
  phase: ProngPhase;
  /** W2's deal of the plan (of the launched raiders after the launch). */
  planned: GuardCounts;
  /** This prong's raiders away now (zeros while mustering). */
  raiders: GuardCounts;
  /** Ticks until arrival at the target, or at the hive when returning (else 0). */
  ticksToArrival: number;
  /** Null until decided (W6), then the prong's own outcome. */
  outcome: ProngOutcome | null;
  /** The haulers H10 holds for this prong. */
  holding: number;
}

/** `raidStatus.prongs`: one entry per prong in prong order (done ones stay until the raid ends), empty when there is no raid. */
function prongStatuses(world: Readonly<World>): ProngStatus[] {
  const r = world.raid;
  if (r === null) return [];
  const hold = world.tun['raid.haulersHold'] === 1;
  return raidProngs(r).map((p) => ({
    target: p.target,
    phase: p.phase,
    planned: { ...p.planned },
    raiders: countOf(p.guards),
    ticksToArrival: p.phase === 'out' || p.phase === 'home' ? p.ticksLeft : 0,
    outcome: prongOutcome(p),
    holding: hold && (p.phase === 'out' || p.phase === 'fight') ? haulersWaitingFor(world, p.target) : 0,
  }));
}

/**
 * W1 for `raidStatus.nextProngs`: how many prongs a raid would have if it mustered now, from today's economy, R4's size and
 * today's raidable nodes; 0 when R3 would not muster for lack of size or target. It ignores the gap, the economy
 * threshold, a raid in progress and a battle at the hive, so the client can say where raids will land before they come.
 */
export function nextProngs(world: Readonly<World>): number {
  const hive = hiveOf(world);
  if (world.tun['raid.enabled'] !== 1 || hive === null || !hive.alive) return 0;
  const k = raidables(world).length;
  if (k === 0) return 0;
  const size = raidSize(world, econAlive(world), hive);
  return size >= 1 ? prongCount(world, k, size) : 0;
}

/**
 * H9 `rockStatus.raidMix`: the guard counts of the prong aimed at `node` (its plan while mustering, then its raiders
 * away), or null when no live prong is aimed there (a done prong aims at nothing). Non-null from muster until that
 * prong is done, the same span as `raidTarget`.
 */
export function raidMixAt(world: Readonly<World>, node: number): GuardCounts | null {
  const r = world.raid;
  if (r === null) return null;
  const p = raidProngs(r).find((q) => q.phase !== 'done' && q.target === node);
  if (p === undefined) return null;
  return p.phase === 'muster' ? { ...p.planned } : countOf(p.guards);
}

/** `raidStatus` (DESIGN.md H7 "Selectors", H9 "Selectors"). */
export interface RaidStatus {
  /** `raid.enabled` is 1 (the client hides the chip when it isn't). */
  enabled: boolean;
  /** 'none' when no raid is in progress. While mustering it is `muster`; afterwards `fight` if any prong fights, else `out` if any is out, else `home`. */
  phase: RaidPhase | 'none';
  /** The raid's planned size by type, summed over the prongs (zeros when none). */
  planned: GuardCounts;
  /** The raiders away from the hive now, by type, over every prong (zeros while mustering: they still defend the hive). */
  raiders: GuardCounts;
  /** Prong 0's target node index (the nearest), or null. */
  target: number | null;
  /** Ticks until the launch (mustering only, else 0). */
  ticksToLaunch: number;
  /** The smallest ticks until arrival over the prongs out or home (else 0). */
  ticksToArrival: number;
  /** R2: economy ships alive. */
  econ: number;
  /** The `raid.firstAtEcon` threshold. */
  nextRaidAtEcon: number;
  /** Ticks until a raid may muster again (the gap), 0 if allowed now. */
  ticksToNextAllowed: number;
  /** The last finished raid, or null. */
  last: RaidResult | null;
  /** H10: haulers held at the probe for this raid, over every prong (0 when none, or `raid.haulersHold` is 0). */
  holding: number;
  /** H9: one entry per prong, in prong order; empty when there is no raid. */
  prongs: ProngStatus[];
  /** H9: how many prongs a raid would have if it mustered now (W1); 0 when R3 would not muster for lack of size or target. */
  nextProngs: number;
}

/** The raid's summary phase (see `RaidStatus.phase`). */
function summaryPhase(raid: Readonly<Raid>): RaidPhase {
  if (raid.phase === 'muster') return 'muster';
  const list = raidProngs(raid);
  if (list.some((p) => p.phase === 'fight')) return 'fight';
  if (list.some((p) => p.phase === 'out')) return 'out';
  return 'home';
}

/** Field mode only (throws in a campaign world). */
export function raidStatus(world: Readonly<World>): RaidStatus {
  if (world.field === null) throw new Error('not a field-mode world');
  const r = world.raid;
  const prongs = prongStatuses(world);
  const planned = zeroGuards();
  for (const p of prongs) {
    planned.thorn += p.planned.thorn;
    planned.spore += p.planned.spore;
  }
  const flying = prongs.filter((p) => p.phase === 'out' || p.phase === 'home').map((p) => p.ticksToArrival);
  return {
    enabled: world.tun['raid.enabled'] === 1,
    phase: r === null ? 'none' : summaryPhase(r),
    planned,
    raiders: raidersOut(world),
    target: r === null ? null : r.target,
    ticksToLaunch: r !== null && r.phase === 'muster' ? r.ticksLeft : 0,
    ticksToArrival: flying.length === 0 ? 0 : Math.min(...flying),
    econ: econAlive(world),
    nextRaidAtEcon: world.tun['raid.firstAtEcon'],
    ticksToNextAllowed: Math.max(0, world.nextRaidTick - world.tick),
    last: world.lastRaid,
    holding: haulersHolding(world),
    prongs,
    nextProngs: nextProngs(world),
  };
}
