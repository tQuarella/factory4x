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

/** R1: a raid's phase. */
export type RaidPhase = 'muster' | 'out' | 'fight' | 'home';

/** How a raid ended (R8), or `withered` when the hive fell with the raid out (R9; not counted in the stats). */
export type RaidOutcome = 'beaten' | 'hit' | 'turnedBack' | 'withered';

/** R1: the raid in progress (`world.raid`), or none (null). */
export interface Raid {
  id: number;
  phase: RaidPhase;
  /** The node the raid is flying to or fighting at (R5), fixed at muster; R6 may retarget it once. While `home` it is the rock it left. */
  target: number;
  /** The raiders, once launched (lowest id of each type first). Empty while mustering: they stay in the hive's guard list. */
  guards: Guard[];
  /** Ticks left in the current phase (the muster countdown, or the flight). */
  ticksLeft: number;
  /** R4: the raid's size by type, fixed at muster (trimmed at launch if the hive can no longer spare them). */
  planned: GuardCounts;
  /** The length of the current flight (out or home) in ticks, 0 while mustering or fighting (the client draws progress from it). */
  flightTicks: number;
  /** The node the current flight started from (the hive, or the rock the raid left or was retargeted from). */
  from: number;
  /** R6: the raid has already retargeted once. */
  retargeted: boolean;
  /** What the raid has done so far (the outcome and `last` read these). */
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

/** Raiders away from the hive, by type. */
function raidersOut(world: Readonly<World>): GuardCounts {
  const c: GuardCounts = { thorn: 0, spore: 0 };
  if (world.raid !== null) for (const g of world.raid.guards) c[g.type] += 1;
  return c;
}

function finish(world: World, outcome: RaidOutcome): void {
  const r = world.raid!;
  world.lastRaid = {
    id: r.id,
    outcome,
    target: r.target,
    endTick: world.tick,
    lostEcon: { ...r.lostEcon },
    lostShips: { ...r.lostShips },
    killed: { ...r.killed },
  };
  world.raid = null;
}

/** R8: the raid ends: record its outcome, clear it and start the gap from now. */
function end(world: World, outcome: Exclude<RaidOutcome, 'withered'>): void {
  const st = world.stats.raids;
  if (outcome === 'beaten') st.beaten += 1;
  else if (outcome === 'hit') st.hit += 1;
  else st.turnedBack += 1;
  finish(world, outcome);
  world.nextRaidTick = world.tick + world.tun['raid.gapTicks'];
}

/** R3: a raid musters when every condition holds. */
function tryMuster(world: World): void {
  const t = world.tun;
  const hive = hiveOf(world);
  if (t['raid.enabled'] !== 1 || hive === null || !hive.alive || world.raid !== null || world.tick < world.nextRaidTick) return;
  const econ = econAlive(world);
  if (econ < t['raid.firstAtEcon'] || hive.battle !== null) return;
  const target = raidTarget(world);
  if (target === null) return;
  const size = raidSize(world, econ, hive);
  if (size < 1) return;
  world.stats.raids.mustered += 1;
  world.raid = {
    id: world.stats.raids.mustered,
    phase: 'muster',
    target,
    guards: [],
    ticksLeft: t['raid.musterTicks'],
    planned: raidMix(size, countGuards(hive)),
    flightTicks: 0,
    from: heartIndex(world),
    retargeted: false,
    lostEcon: zeroEcon(),
    lostShips: zeroShips(),
    killed: { thorn: 0, spore: 0 },
  };
}

function startFlight(world: World, raid: Raid, from: number, to: number): void {
  raid.from = from;
  raid.flightTicks = ceilDiv(nodeDistance(world, from, to), world.tun['raid.speedSu']);
  raid.ticksLeft = raid.flightTicks;
}

function goHome(world: World, raid: Raid): void {
  raid.phase = 'home';
  startFlight(world, raid, raid.target, heartIndex(world));
}

/** R6: the muster countdown, then the launch. A battle at the hive cancels it. */
function muster(world: World, raid: Raid, hive: Guardian): void {
  if (hive.battle !== null) {
    world.raid = null;
    world.nextRaidTick = world.tick;
    return;
  }
  if (raid.ticksLeft > 0) raid.ticksLeft -= 1;
  if (raid.ticksLeft > 0) return;
  // Launch: the planned raiders, lowest id of each type first, capped at what's alive above the keep.
  const spare = Math.max(0, hive.guards.length - raidKeep(world, hive));
  const take = launchMix(raid.planned, countGuards(hive), spare);
  if (take.thorn + take.spore < 1) {
    world.raid = null;
    world.nextRaidTick = world.tick;
    return;
  }
  const left: Guard[] = [];
  const need: GuardCounts = { ...take };
  for (const g of hive.guards) {
    if (need[g.type] > 0) {
      need[g.type] -= 1;
      raid.guards.push(g);
    } else left.push(g);
  }
  hive.guards = left;
  raid.planned = take;
  raid.phase = 'out';
  startFlight(world, raid, heartIndex(world), raid.target);
}

/** R6: arrival at the target; if it is no longer mined the raid retargets once, or flies home. */
function arrive(world: World, raid: Raid): void {
  if (isRaidable(world, raid.target)) {
    raid.phase = 'fight';
    raid.from = raid.target;
    raid.flightTicks = 0;
    return;
  }
  const next = raid.retargeted ? null : raidTarget(world);
  if (next === null) {
    goHome(world, raid);
    return;
  }
  raid.retargeted = true;
  const from = raid.target;
  raid.target = next;
  startFlight(world, raid, from, next);
}

/** R7: one round at the target. */
function fight(world: World, raid: Raid): void {
  if (world.tick % world.tun['combat.roundTicks'] !== 0) return;
  const f = fieldOf(world);
  const warships: Ship[] = world.ships.filter((s) => s.at === raid.target);
  const econ: EconShip[] = f.econ.filter((s) => s.at === raid.target);
  if (warships.length === 0 && econ.length === 0) {
    goHome(world, raid);
    return;
  }
  const byType = { drone: 0, lancer: 0, flak: 0 };
  for (const s of warships) byType[s.type] += 1;
  // Both sides strike from the start-of-round state: the pools are sized before the warships' damage lands.
  const pools = guardPools(world.tun, raid.guards);
  playerDamage(world.tun, raid.guards, byType);
  const kills = guardStrike(pools, warships, econ);
  for (const s of kills.ships) {
    raid.lostShips[s.type] += 1;
    world.stats.shipsLost[s.type] += 1;
  }
  for (const s of kills.econ) {
    raid.lostEcon[s.type] += 1;
    world.stats.econLost[s.type] += 1;
  }
  if (kills.ships.length > 0) world.ships = world.ships.filter((s) => s.hp > 0);
  if (kills.econ.length > 0) {
    f.econ = f.econ.filter((s) => s.hp > 0);
    // A docked extractor may have died: the node's extractors count drops this tick.
    syncExtractors(world);
  }
  for (const g of raid.guards) {
    if (g.hp > 0) continue;
    raid.killed[g.type] += 1;
    world.stats.guardsKilled[g.type] += 1;
  }
  raid.guards = raid.guards.filter((g) => g.hp > 0);
  if (raid.guards.length === 0) end(world, 'beaten');
}

/** R8: the raiders reach the hive and rejoin its guard list (ascending id), with their hp and ids. */
function returnHome(world: World, raid: Raid, hive: Guardian): void {
  hive.guards = [...hive.guards, ...raid.guards].sort((a, b) => a.id - b.id);
  end(world, raid.lostEcon.extractor + raid.lostEcon.hauler > 0 ? 'hit' : 'turnedBack');
}

/**
 * F8, the raid hook. Called once per field-mode tick, after movement (F7) and before combat at guarded nodes
 * (F10). Muster (R3), launch (R6), the fight (R7) and the return (R8); the hive's regrowth with raiders out is
 * `hiveRegrow` (R9) and the withering at capture is `raidWither`. After removing a docked extractor it calls
 * `syncExtractors` so the node's `extractors` count drops the same tick.
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
  if (raid.phase === 'fight') {
    fight(world, raid);
    return;
  }
  // Out or home: fly.
  raid.ticksLeft -= 1;
  if (raid.ticksLeft > 0) return;
  if (raid.phase === 'out') arrive(world, raid);
  else returnHome(world, raid, hive);
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
 * DESIGN.md H8 H10 ("Haulers hold", `raid.haulersHold`): true while haulers whose node is `node` hold for a raid.
 * `runHaulers` (F6) asks it for a hauler at the probe (true: it stays there and keeps its assignment) and for a
 * hauler at its node (true: it loads min(buffer, cargo) and leaves at once); a hauler flying out finishes its leg
 * and is then asked at the node. `rockStatus.haulersHeld` reads it too.
 *
 * h8-sim stub: always false (H7's haulers). h8-raids implements it (from launch, phase `out`, to the raid's end,
 * for the raid's target, when raid.haulersHold is 1).
 */
export function haulersHeld(world: Readonly<World>, node: number): boolean {
  // The stub reads its arguments only to keep the signature h8-raids implements.
  void world;
  void node;
  return false;
}

/** `raidStatus` (DESIGN.md H7 "Selectors"). */
export interface RaidStatus {
  /** `raid.enabled` is 1 (the client hides the chip when it isn't). */
  enabled: boolean;
  /** 'none' when no raid is in progress. */
  phase: RaidPhase | 'none';
  /** The raid's planned size by type (zeros when none). */
  planned: GuardCounts;
  /** The raiders away from the hive now, by type (zeros while mustering: they still defend the hive). */
  raiders: GuardCounts;
  /** The target node index, or null. */
  target: number | null;
  /** Ticks until the launch (mustering only, else 0). */
  ticksToLaunch: number;
  /** Ticks until arrival at the target, or at the hive when returning (else 0). */
  ticksToArrival: number;
  /** R2: economy ships alive. */
  econ: number;
  /** The `raid.firstAtEcon` threshold. */
  nextRaidAtEcon: number;
  /** Ticks until a raid may muster again (the gap), 0 if allowed now. */
  ticksToNextAllowed: number;
  /** The last finished raid, or null. */
  last: RaidResult | null;
}

/** Field mode only (throws in a campaign world). */
export function raidStatus(world: Readonly<World>): RaidStatus {
  if (world.field === null) throw new Error('not a field-mode world');
  const r = world.raid;
  return {
    enabled: world.tun['raid.enabled'] === 1,
    phase: r === null ? 'none' : r.phase,
    planned: r === null ? { thorn: 0, spore: 0 } : { ...r.planned },
    raiders: raidersOut(world),
    target: r === null ? null : r.target,
    ticksToLaunch: r !== null && r.phase === 'muster' ? r.ticksLeft : 0,
    ticksToArrival: r !== null && (r.phase === 'out' || r.phase === 'home') ? r.ticksLeft : 0,
    econ: econAlive(world),
    nextRaidAtEcon: world.tun['raid.firstAtEcon'],
    ticksToNextAllowed: Math.max(0, world.nextRaidTick - world.tick),
    last: world.lastRaid,
  };
}
