import {
  COMBAT_ORDER,
  COMPONENTS,
  COMPONENT_INPUT,
  GUARD_TYPES,
  SHIP_COMPONENT,
  YARD_ORDER,
  YARD_ROTATION,
  type GuardType,
  type ShipType,
  type SimData,
  type Tunables,
} from './data.ts';
import { designResearched, extractPct, reclaimActive, shipments, yardBuildTicks } from './campaign.ts';
import { allocate, captureField, fieldStats, moveEcon, recordDelivery, runBays, runExtractors, runHaulers, syncExtractors } from './field.ts';
import { raidStep } from './factions/index.ts';
import { fleetCap, isFleetFull } from './fleet.ts';
import { applyInput, type Input } from './inputs.ts';
import { ceilDiv } from './math.ts';
import { advance, newShip } from './ships.ts';
import {
  PROBE,
  addGuard,
  countGuards,
  guardCaps,
  guardRegrowTicks,
  guardRepair,
  guardianAt,
  heartIndex,
  nodeDistance,
  routeFrom,
  ticksPerMin,
  type Battle,
  type BattleOutcome,
  type BattleResult,
  type EconShip,
  type Guard,
  type Guardian,
  type Ship,
  type Wilt,
  type World,
} from './world.ts';

/**
 * One tick of DESIGN.md "Rules per tick" (H1 numbering, with the H2, H3 and
 * H4 changes), systems in the stated order. H4: with no area active only
 * rule 1 runs; in an area, rules 2-9 and stats run, then rule 10 (shipments). Every loop runs over a dense array
 * in id (or node index) order, or over a fixed type order; rules 7-9 each run
 * over all guardians (node order) before the next rule starts.
 */

/** Rule 2. */
function construction(world: World): void {
  const a = world.activeBuild;
  if (a) {
    a.ticksLeft -= 1;
    if (a.ticksLeft <= 0) {
      const node = world.nodes[a.node]!;
      if (a.kind === 'extractor') {
        node.extractors += 1;
        node.owned = true;
      } else if (a.kind === 'route') {
        world.routes.push({
          id: world.nextId++,
          from: a.node,
          to: PROBE,
          length: nodeDistance(world, a.node, PROBE),
          level: 1,
          cooldown: 0,
          pods: [],
        });
      } else {
        const route = routeFrom(world, a.node);
        if (route && route.level < world.tun['route.maxLevel']) route.level += 1;
      }
      world.activeBuild = null;
    }
  }
  if (world.activeBuild === null && world.queue.length > 0) {
    const head = world.queue[0]!;
    if (head.kind === 'upgrade') {
      // Only reachable if route.maxLevel was tuned down after queuing: drop the order unpaid.
      const route = routeFrom(world, head.node);
      if (!route || route.level >= world.tun['route.maxLevel']) {
        world.queue.shift();
        return;
      }
    }
    if (world.stock.ore >= head.cost) {
      world.stock.ore -= head.cost;
      world.stats.oreSpentEconomy += head.cost;
      world.queue.shift();
      const ticks = head.kind === 'extractor' ? world.tun['extractor.buildTicks'] : world.tun['route.buildTicks'];
      world.activeBuild = { kind: head.kind, node: head.node, ticksLeft: ticks };
    }
  }
}

/** Units per minute one extractor at a node of this kind yields (0 for nodes that never extract). */
export function perExtractorPerMin(t: Readonly<Tunables>, kind: World['nodes'][number]['kind']): number {
  if (kind === 'asteroid') return t['extractor.orePerMin'];
  if (kind === 'pocket') return t['pocket.resourcePerMin'];
  if (kind === 'heart') return t['heart.orePerMin'];
  return 0;
}

/**
 * Rule 3. H4 Extraction research: a node's accumulator (units·ticks/min × 100)
 * adds extractors × perExtractorPerMin × (100 + level × stepPct) and yields a
 * unit each time it reaches ticksPerMin × 100. Probe mining is not boosted.
 */
function extraction(world: World): void {
  const T = ticksPerMin(world);
  const unit = T * 100;
  const pct = extractPct(world);
  const cap = world.tun['node.bufferCap'];
  for (const node of world.nodes) {
    if (node.extractors === 0) continue;
    node.accum += node.extractors * perExtractorPerMin(world.tun, node.kind) * pct;
    while (node.accum >= unit) {
      node.accum -= unit;
      if (node.buffer < cap) node.buffer += 1;
    }
  }
  world.probeAccum += world.tun['economy.probeOrePerMin'];
  while (world.probeAccum >= T) {
    world.probeAccum -= T;
    world.stock.ore += 1;
  }
}

/** Rule 4. */
function routes(world: World): void {
  const t = world.tun;
  for (const route of world.routes) {
    if (route.cooldown > 0) route.cooldown -= 1;
    const src = world.nodes[route.from]!;
    if (route.cooldown === 0 && src.buffer > 0 && src.prize !== null) {
      const amount = Math.min(src.buffer, route.level * t['route.podOrePerLevel']);
      src.buffer -= amount;
      route.pods.push({ res: src.prize, amount, ticksLeft: ceilDiv(route.length, t['route.podSpeedSu']) });
      route.cooldown = t['route.podIntervalTicks'];
    }
    let delivered = false;
    for (const pod of route.pods) {
      pod.ticksLeft -= 1;
      if (pod.ticksLeft <= 0) {
        recordDelivery(world, pod.res, pod.amount);
        delivered = true;
      }
    }
    if (delivered) route.pods = route.pods.filter((p) => p.ticksLeft > 0);
  }
}

/** Ore reserved by unpaid build orders (queued builds pay before assemblers and yards). */
export function reservedOre(world: Readonly<World>): number {
  let sum = 0;
  for (const o of world.queue) sum += o.cost;
  return sum;
}

/** Rule 5a: lens, then plating. */
function assemblers(world: World): void {
  const t = world.tun;
  const reserved = reservedOre(world);
  for (const c of COMPONENTS) {
    const a = world.assemblers[c];
    if (a.ticksLeft > 0) {
      a.ticksLeft -= 1;
      if (a.ticksLeft === 0) {
        world.stock[c] += 1;
        world.stats.componentsBuilt[c] += 1;
      }
    }
    if (a.ticksLeft !== 0) continue;
    const res = COMPONENT_INPUT[c];
    const ore = t[`component.${c}.ore`];
    const need = c === 'lens' ? t['component.lens.crystal'] : t['component.plating.ice'];
    if (world.stock[c] < t['component.stockCap'] && world.stock.ore - reserved >= ore && world.stock[res] >= need) {
      world.stock.ore -= ore;
      world.stock[res] -= need;
      world.stats.oreSpentComponents += ore;
      a.ticksLeft = t['component.buildTicks'];
    }
  }
}

/**
 * Starts a build at an idle, switched-on yard if its design is researched (H4),
 * the fleet is below its limit (H5; the count includes builds started earlier
 * this tick), and ore (net of reservations) and its component allow. The
 * build takes yardBuildTicks (H4 Fast yards). Returns true if it started.
 */
function startShip(world: World, data: SimData, type: ShipType): boolean {
  const t = world.tun;
  const yard = world.yards[type];
  if (!yard.on || yard.ticksLeft !== 0 || !designResearched(world, type)) return false;
  if (isFleetFull(world, data)) return false;
  const cost = t[`ship.${type}.cost`];
  const comp = SHIP_COMPONENT[type];
  // Recomputed per yard: reservedOre doesn't change here, but stock does.
  if (world.stock.ore - reservedOre(world) < cost) return false;
  if (comp !== null && world.stock[comp] < 1) return false;
  world.stock.ore -= cost;
  if (comp !== null) world.stock[comp] -= 1;
  world.stats.oreSpentShips += cost;
  yard.ticksLeft = yardBuildTicks(world, type);
  return true;
}

/**
 * Rule 5b. Builds in progress tick down and finished ships spawn in the order
 * lancer, flak, drone. Then idle yards start: the component yards first, in
 * turn from `world.yardTurn` (each start passes the turn to the yard after
 * it), then the drone yard. H5: a yard that can't start because the fleet
 * is full keeps its turn, like one waiting for a component.
 */
function yards(world: World, data: SimData): void {
  for (const type of YARD_ORDER) {
    const yard = world.yards[type];
    if (yard.ticksLeft > 0) {
      yard.ticksLeft -= 1;
      if (yard.ticksLeft === 0) newShip(world, type);
    }
  }
  const n = YARD_ROTATION.length;
  const first = world.yardTurn;
  for (let i = 0; i < n; i++) {
    const k = (first + i) % n;
    if (startShip(world, data, YARD_ROTATION[k]!)) world.yardTurn = (k + 1) % n;
  }
  startShip(world, data, 'drone');
}

/** Rule 6. */
function movement(world: World): void {
  for (const s of world.ships) advance(s);
}

/** Ships parked at `node`, in id order. */
function shipsAt(world: World, node: number): Ship[] {
  const present: Ship[] = [];
  for (const s of world.ships) if (s.at === node) present.push(s);
  return present;
}

/** Target order per ship type (rule 7). Drones use all guards in id order and are handled apart. */
const TARGET_ORDER: Readonly<Record<'lancer' | 'flak', readonly GuardType[]>> = {
  lancer: ['thorn', 'spore'],
  flak: ['spore', 'thorn'],
};

/**
 * Rule 7, guard damage (DESIGN.md H6 "Combat amendment"): the ship types each guard type's pool strikes, in order.
 * Each strikes first the type that is Weak against it and last the type that counters it; drones sit between.
 */
export const GUARD_TARGET_ORDER: Readonly<Record<GuardType, readonly ShipType[]>> = {
  thorn: ['flak', 'drone', 'lancer'],
  spore: ['lancer', 'drone', 'flak'],
};

/** Damage multiplier, percent, of a ship type against a guard type: strong, weak, or 100 for drones. */
export function counterPct(t: Readonly<Tunables>, ship: ShipType, guard: GuardType): number {
  if (ship === 'drone') return 100;
  const strong = (ship === 'lancer') === (guard === 'thorn');
  return strong ? t['counter.strongPct'] : t['counter.weakPct'];
}

/**
 * Applies `dmg` to the living guards (hp > 0) of `type` (or of every type when
 * null) in id order, overflowing from one to the next as in H1. Returns the
 * damage left over.
 */
function applyToGuards(guards: Guard[], type: GuardType | null, dmg: number): number {
  for (const gd of guards) {
    if (dmg <= 0) break;
    if (gd.hp <= 0 || (type !== null && gd.type !== type)) continue;
    const hit = Math.min(dmg, gd.hp);
    gd.hp -= hit;
    dmg -= hit;
  }
  return dmg;
}

function anyLiving(guards: readonly Guard[], type: GuardType): boolean {
  for (const gd of guards) if (gd.type === type && gd.hp > 0) return true;
  return false;
}

/**
 * Rule 7 player damage for one round: each ship type present, in the order
 * lancer, flak, drone, pools its damage and walks its target order. Damage
 * from earlier types is already applied when later types act.
 */
export function playerDamage(t: Readonly<Tunables>, guards: Guard[], present: Readonly<Record<ShipType, number>>): void {
  for (const type of COMBAT_ORDER) {
    const n = present[type];
    if (n === 0) continue;
    let base = n * t[`ship.${type}.damage`];
    if (type === 'drone') {
      applyToGuards(guards, null, base);
      continue;
    }
    for (const gt of TARGET_ORDER[type]) {
      if (base <= 0) break;
      // A type with no living guards takes nothing, so the pool passes on unconverted (DECISIONS.md, h3-sim).
      if (!anyLiving(guards, gt)) continue;
      const pct = counterPct(t, type, gt);
      const left = applyToGuards(guards, gt, Math.floor((base * pct) / 100));
      base = anyLiving(guards, gt) ? 0 : Math.floor((left * 100) / pct);
    }
  }
}

/** Rule 7: each guard type's damage pool for one round, from the living guards at the start of the round. */
export function guardPools(t: Readonly<Tunables>, guards: readonly Guard[]): Record<GuardType, number> {
  const pools: Record<GuardType, number> = { thorn: 0, spore: 0 };
  for (const gd of guards) pools[gd.type] += t[`guard.${gd.type}.damage`];
  return pools;
}

/** H7 R7: after the warships, a raid's pools strike haulers, then extractors. */
export const ECON_STRIKE_ORDER: readonly EconShip['type'][] = ['hauler', 'extractor'];

/** The units a guardStrike brought to hp ≤ 0, each list in the order they fell. */
export interface StrikeKills {
  ships: Ship[];
  econ: EconShip[];
}

function strikeType<T extends Ship | EconShip>(list: readonly T[], type: T['type'], pool: number, killed: T[]): number {
  for (const s of list) {
    if (pool <= 0) break;
    if (s.type !== type || s.hp <= 0) continue;
    const hit = Math.min(pool, s.hp);
    s.hp -= hit;
    pool -= hit;
    if (s.hp <= 0) killed.push(s);
  }
  return pool;
}

/**
 * Rule 7 guard damage (DESIGN.md H6 "Combat amendment"), used by F10 at guarded nodes and exported for the H7
 * raid fight (R7). Each guard type's pool, Thorns then Spores, strikes the warships in GUARD_TARGET_ORDER (the
 * type it counters first), within a type in id order, with overflow to the next ship and the next type; for a raid
 * it then goes on to `econ`: haulers, then extractors (ECON_STRIKE_ORDER), in id order. Ships already at hp ≤ 0
 * are skipped. Mutates hp in place; the caller removes the dead and keeps the books.
 */
export function guardStrike(pools: Readonly<Record<GuardType, number>>, warships: readonly Ship[], econ: readonly EconShip[] = []): StrikeKills {
  const kills: StrikeKills = { ships: [], econ: [] };
  for (const gt of GUARD_TYPES) {
    let pool = pools[gt];
    for (const type of GUARD_TARGET_ORDER[gt]) pool = strikeType(warships, type, pool, kills.ships);
    for (const type of ECON_STRIKE_ORDER) pool = strikeType(econ, type, pool, kills.econ);
  }
  return kills;
}

function newBattle(world: World, data: SimData, g: Guardian): Battle {
  return {
    id: world.nextId++,
    node: g.node,
    startTick: world.tick,
    guardsAtStart: countGuards(g),
    shipsEngaged: 0,
    engagedByType: { drone: 0, lancer: 0, flak: 0 },
    shipsLost: 0,
    lostByType: { drone: 0, lancer: 0, flak: 0 },
    guardsKilled: 0,
    killedByType: { thorn: 0, spore: 0 },
    capAtSend: fleetCap(world, data),
  };
}

/** Rule 7, for one living guardian: a round against the ships at its node, then repair. */
function combat(world: World, data: SimData, g: Guardian): void {
  const t = world.tun;
  let lastShipsDied = false;
  if (world.tick % t['combat.roundTicks'] === 0) {
    const present = shipsAt(world, g.node);
    if (present.length > 0 && g.guards.length > 0) {
      if (g.battle === null) g.battle = newBattle(world, data, g);
      const battle = g.battle;
      const byType = { drone: 0, lancer: 0, flak: 0 };
      for (const s of present) {
        byType[s.type] += 1;
        if (s.engagedIn !== battle.id) {
          s.engagedIn = battle.id;
          battle.shipsEngaged += 1;
          battle.engagedByType[s.type] += 1;
        }
      }
      // Both sides' damage comes from the state at the start of the round: the guard pools are sized before
      // the ships strike, so a guard that dies this round still hits.
      const pools = guardPools(t, g.guards);
      playerDamage(t, g.guards, byType);
      let shipsKilled = 0;
      for (const s of guardStrike(pools, present).ships) {
        shipsKilled++;
        battle.lostByType[s.type] += 1;
        world.stats.shipsLost[s.type] += 1;
      }
      let guardsKilled = 0;
      for (const gd of g.guards) {
        if (gd.hp > 0) continue;
        guardsKilled++;
        battle.killedByType[gd.type] += 1;
        world.stats.guardsKilled[gd.type] += 1;
      }
      if (guardsKilled > 0) g.guards = g.guards.filter((gd) => gd.hp > 0);
      if (shipsKilled > 0) {
        world.ships = world.ships.filter((s) => s.hp > 0);
        lastShipsDied = shipsKilled === present.length;
      }
      battle.guardsKilled += guardsKilled;
      battle.shipsLost += shipsKilled;
      g.guardsKilled += guardsKilled;
      g.shipsLost += shipsKilled;
    }
    // Repair on every round tick, fight or not, up to the type's hp.
    const repair = { thorn: guardRepair(world, g, 'thorn'), spore: guardRepair(world, g, 'spore') };
    for (const gd of g.guards) {
      const maxHp = t[`guard.${gd.type}.hp`];
      if (gd.hp < maxHp) gd.hp = Math.min(gd.hp + repair[gd.type], maxHp);
    }
  }
  if (g.battle !== null) {
    let anyPresent = false;
    for (const s of world.ships) {
      if (s.at === g.node) {
        anyPresent = true;
        break;
      }
    }
    if (!anyPresent) endBattle(world, g, lastShipsDied ? 'repelled' : 'withdrew', null);
  }
}

function endBattle(world: World, g: Guardian, outcome: BattleOutcome, wilt: Wilt | null): void {
  const b = g.battle;
  if (b === null) return;
  const result: BattleResult = { ...b, endTick: world.tick, outcome, wilt };
  g.lastBattle = result;
  world.lastBattle = result;
  g.battle = null;
}

/** The wilt (rule 8, Root): the heart starves and drops its newest guards of each type down to the starved caps. Counted as withered, not killed. */
function wilt(world: World): Wilt | null {
  const heart = guardianAt(world, heartIndex(world))!;
  if (!heart.alive) return null;
  heart.fed = false;
  const from = countGuards(heart);
  const caps = guardCaps(world, heart);
  const count = { ...from };
  for (const type of GUARD_TYPES) {
    while (count[type] > caps[type]) {
      // Guards are in ascending id order: the newest of this type is the last one.
      let i = heart.guards.length - 1;
      while (heart.guards[i]!.type !== type) i--;
      heart.guards.splice(i, 1);
      count[type] -= 1;
      world.stats.guardsWithered += 1;
    }
  }
  heart.regrowProgress = { thorn: 0, spore: 0 };
  return { from, to: count };
}

/** Rule 8, for one living guardian. H4: capturing the heart also reclaims the area. */
function capture(world: World, data: SimData, g: Guardian): void {
  if (g.guards.length > 0) return;
  const present = shipsAt(world, g.node);
  if (present.length === 0) return;
  g.alive = false;
  g.regrowProgress = { thorn: 0, spore: 0 };
  const node = world.nodes[g.node]!;
  node.owned = true;
  world.stats.captures.push({ node: g.node, tick: world.tick });
  // Capture without a fought round (guards and ships traded out to zero, or a zero-cap node, then a ship arrived).
  if (g.battle === null) {
    const b = newBattle(world, data, g);
    for (const s of present) {
      b.shipsEngaged += 1;
      b.engagedByType[s.type] += 1;
    }
    g.battle = b;
  }
  if (node.kind === 'root') {
    world.stats.rootCutTick = world.tick;
    endBattle(world, g, 'captured', wilt(world));
    return;
  }
  if (world.field !== null) {
    // H7 F11: Mine-marked with its free extractor; capturing the hive wins the run (free play continues).
    captureField(world, g.node);
    if (node.kind === 'heart') world.capturedTick = world.tick;
  } else if (node.kind === 'pocket') {
    node.extractors = Math.min(world.tun['pocket.freeExtractors'], node.slots);
  } else {
    node.extractors = Math.min(world.tun['heart.freeExtractors'], node.slots);
    world.capturedTick = world.tick;
    reclaimActive(world, data);
  }
  endBattle(world, g, 'captured', null);
}

/** Rule 9, for one living guardian: each type regrows toward its effective cap at its own period. */
function regrowth(world: World, g: Guardian): void {
  const caps = guardCaps(world, g);
  const count = countGuards(g);
  for (const type of GUARD_TYPES) {
    if (count[type] >= caps[type]) {
      g.regrowProgress[type] = 0;
      continue;
    }
    g.regrowProgress[type] += 1;
    if (g.regrowProgress[type] >= guardRegrowTicks(world, g, type)) {
      addGuard(world, g, type);
      g.regrowProgress[type] = 0;
    }
  }
}

function sum(buckets: readonly number[]): number {
  let s = 0;
  for (const b of buckets) s += b;
  return s;
}

/** Sum of the ore delivery ring buffer: ore delivered over the last window (a minute at the fixed 60 s window). */
export function deliveredInWindow(world: Readonly<World>): number {
  return sum(world.stats.deliveredBuckets);
}

/** The same for a prize resource (ice or crystal). */
export function prizeInWindow(world: Readonly<World>, res: 'ice' | 'crystal'): number {
  return sum(world.stats.prizeBuckets[res]);
}

/** Stats (H1-H3 rule 10; runs before the H4 rule 10, shipments). */
function stats(world: World): void {
  const st = world.stats;
  const s = deliveredInWindow(world);
  if (s > st.peakPerMin) st.peakPerMin = s;
  // The next tick starts a new game second: clear the bucket it will write to, in every ring buffer.
  const next = world.tick + 1;
  if (next % world.tickRate === 0) {
    const i = Math.floor(next / world.tickRate) % st.deliveredBuckets.length;
    st.deliveredBuckets[i] = 0;
    st.prizeBuckets.ice[i] = 0;
    st.prizeBuckets.crystal[i] = 0;
  }
}

/**
 * H7 field mode, one tick after F1 (the inputs), in DESIGN.md H7's order: F2 allocation, F3 bays, F4 extraction,
 * F5 extractors, F6 haulers, F7 movement (warships, then economy ships, then docking), F8 the raid hook, F10
 * combat, F11 capture and regrowth (each over every guardian in node order), then stats. F9 (the fleet limit) is
 * checked inside F3. The campaign rules 2, 4, 5 and 10 (construction, routes, assemblers and yards, shipments)
 * never run in field mode.
 */
function fieldStep(world: World, data: SimData): void {
  const gs = world.guardians;
  // A recycle among the inputs may have removed a docked extractor.
  syncExtractors(world);
  allocate(world);
  runBays(world, data);
  extraction(world);
  runExtractors(world);
  // An extractor unbound in F5 no longer works its node: haulers there see it this tick.
  syncExtractors(world);
  runHaulers(world);
  movement(world);
  moveEcon(world);
  syncExtractors(world);
  raidStep(world, data);
  for (const g of gs) if (g.alive) combat(world, data, g);
  for (const g of gs) if (g.alive) capture(world, data, g);
  for (const g of gs) if (g.alive) regrowth(world, g);
  stats(world);
  fieldStats(world);
}

/** Advances the world by one tick, applying `inputs` first (rule 1). Throws if `data` is for a different data version. */
export function step(world: World, data: SimData, inputs: readonly Input[]): void {
  if (world.dataVersion !== data.dataVersion) {
    throw new Error(`World is data version ${world.dataVersion}, data is ${data.dataVersion}`);
  }
  if (inputs.length > 0) {
    const before = world.guardians;
    const wavesBefore = before.map((g) => g.wavesSent);
    for (const input of inputs) applyInput(world, data, input);
    // Several attack orders on one guarded node in the same tick are one wave ("All" sends one order per source node).
    // If the tick's inputs landed in (or left) an area, the area's guardians are new and start from 0 waves.
    const gs = world.guardians;
    const same = gs === before;
    let extra = 0;
    for (let i = 0; i < gs.length; i++) {
      const over = gs[i]!.wavesSent - ((same ? wavesBefore[i]! : 0) + 1);
      if (over > 0) {
        gs[i]!.wavesSent -= over;
        extra += over;
      }
    }
    world.stats.wavesSent -= extra;
  }
  if (world.field !== null) {
    fieldStep(world, data);
    world.tick += 1;
    return;
  }
  // The overworld is paused: rule 1 only.
  if (world.campaign.active === null) {
    world.tick += 1;
    return;
  }
  const gs = world.guardians;
  construction(world);
  extraction(world);
  routes(world);
  assemblers(world);
  yards(world, data);
  movement(world);
  for (const g of gs) if (g.alive) combat(world, data, g);
  for (const g of gs) if (g.alive) capture(world, data, g);
  for (const g of gs) if (g.alive) regrowth(world, g);
  stats(world);
  shipments(world, data);
  world.tick += 1;
}
