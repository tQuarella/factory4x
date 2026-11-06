import type { SimData } from './data.ts';
import { applyInput, startTransit, type Input } from './inputs.ts';
import { ceilDiv } from './math.ts';
import { PROBE, addThorn, nodeDistance, richIndex, routeFrom, ticksPerMin, type Ship, type World } from './world.ts';

/**
 * One tick of DESIGN.md H1 "Rules per tick", systems in the stated order.
 * Every loop runs over a dense array in id (or node index) order.
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
    if (world.stock >= head.cost) {
      world.stock -= head.cost;
      world.stats.oreSpentEconomy += head.cost;
      world.queue.shift();
      const ticks = head.kind === 'extractor' ? world.tun['extractor.buildTicks'] : world.tun['route.buildTicks'];
      world.activeBuild = { kind: head.kind, node: head.node, ticksLeft: ticks };
    }
  }
}

/** Rule 3. */
function extraction(world: World): void {
  const T = ticksPerMin(world);
  const cap = world.tun['node.bufferCap'];
  for (const node of world.nodes) {
    if (node.extractors === 0) continue;
    const perMin = node.kind === 'rich' ? world.tun['rich.orePerMin'] : world.tun['extractor.orePerMin'];
    node.accum += node.extractors * perMin;
    while (node.accum >= T) {
      node.accum -= T;
      if (node.buffer < cap) node.buffer += 1;
    }
  }
  world.probeAccum += world.tun['economy.probeOrePerMin'];
  while (world.probeAccum >= T) {
    world.probeAccum -= T;
    world.stock += 1;
  }
}

/** Rule 4. */
function routes(world: World): void {
  const t = world.tun;
  const buckets = world.stats.deliveredBuckets;
  const bucket = Math.floor(world.tick / world.tickRate) % buckets.length;
  for (const route of world.routes) {
    if (route.cooldown > 0) route.cooldown -= 1;
    const src = world.nodes[route.from]!;
    if (route.cooldown === 0 && src.buffer > 0) {
      const amount = Math.min(src.buffer, route.level * t['route.podOrePerLevel']);
      src.buffer -= amount;
      route.pods.push({ amount, ticksLeft: ceilDiv(route.length, t['route.podSpeedSu']) });
      route.cooldown = t['route.podIntervalTicks'];
    }
    let delivered = false;
    for (const pod of route.pods) {
      pod.ticksLeft -= 1;
      if (pod.ticksLeft <= 0) {
        world.stock += pod.amount;
        buckets[bucket] = buckets[bucket]! + pod.amount;
        delivered = true;
      }
    }
    if (delivered) route.pods = route.pods.filter((p) => p.ticksLeft > 0);
  }
}

function newShip(world: World): Ship {
  const ship: Ship = { id: world.nextId++, hp: world.tun['ship.hp'], at: PROBE, transit: null, engagedIn: -1 };
  world.ships.push(ship);
  world.stats.shipsBuilt += 1;
  if (world.stats.firstShipTick === null) world.stats.firstShipTick = world.tick;
  if (world.rally !== PROBE) startTransit(world, ship, world.rally);
  return ship;
}

/** Ore reserved by unpaid build orders. */
export function reservedOre(world: Readonly<World>): number {
  let sum = 0;
  for (const o of world.queue) sum += o.cost;
  return sum;
}

/** Rule 5. */
function shipyard(world: World): void {
  const yard = world.shipyard;
  if (yard.ticksLeft > 0) {
    yard.ticksLeft -= 1;
    if (yard.ticksLeft === 0) newShip(world);
  }
  const cost = world.tun['ship.cost'];
  if (yard.on && yard.ticksLeft === 0 && world.stock - reservedOre(world) >= cost) {
    world.stock -= cost;
    world.stats.oreSpentShips += cost;
    yard.ticksLeft = world.tun['ship.buildTicks'];
  }
}

/** Rule 6. */
function movement(world: World): void {
  for (const s of world.ships) {
    const tr = s.transit;
    if (tr === null) continue;
    tr.ticksLeft -= 1;
    if (tr.ticksLeft <= 0) {
      s.at = tr.to;
      s.transit = null;
    }
  }
}

/** Rule 7. Runs only while the Bloom is alive. */
function combat(world: World, rich: number): void {
  const g = world.guardian;
  const t = world.tun;
  let lastShipsDied = false;
  if (world.tick % t['combat.roundTicks'] === 0) {
    const present: Ship[] = [];
    for (const s of world.ships) if (s.at === rich) present.push(s);
    if (present.length > 0 && g.thorns.length > 0) {
      if (world.battle === null) {
        world.battle = { startTick: world.tick, shipsEngaged: 0, shipsLost: 0, thornsKilled: 0 };
      }
      const battle = world.battle;
      for (const s of present) {
        if (s.engagedIn !== battle.startTick) {
          s.engagedIn = battle.startTick;
          battle.shipsEngaged += 1;
        }
      }
      // Both sides' damage comes from counts at the start of the round.
      let playerDamage = present.length * t['ship.damage'];
      let bloomDamage = g.thorns.length * t['guardian.thornDamage'];
      let thornsKilled = 0;
      for (const th of g.thorns) {
        if (playerDamage <= 0) break;
        const hit = Math.min(playerDamage, th.hp);
        th.hp -= hit;
        playerDamage -= hit;
        if (th.hp <= 0) thornsKilled++;
      }
      let shipsKilled = 0;
      for (const s of present) {
        if (bloomDamage <= 0) break;
        const hit = Math.min(bloomDamage, s.hp);
        s.hp -= hit;
        bloomDamage -= hit;
        if (s.hp <= 0) shipsKilled++;
      }
      if (thornsKilled > 0) g.thorns = g.thorns.filter((th) => th.hp > 0);
      if (shipsKilled > 0) {
        world.ships = world.ships.filter((s) => s.hp > 0);
        lastShipsDied = shipsKilled === present.length;
      }
      battle.thornsKilled += thornsKilled;
      battle.shipsLost += shipsKilled;
      world.stats.thornsKilled += thornsKilled;
      world.stats.shipsLost += shipsKilled;
    }
    // Repair on every round tick, fight or not.
    const maxHp = t['guardian.thornHp'];
    const repair = t['guardian.repairPerRound'];
    for (const th of g.thorns) if (th.hp < maxHp) th.hp = Math.min(th.hp + repair, maxHp);
  }
  if (world.battle !== null) {
    let anyPresent = false;
    for (const s of world.ships) {
      if (s.at === rich) {
        anyPresent = true;
        break;
      }
    }
    if (!anyPresent) endBattle(world, lastShipsDied ? 'repelled' : 'withdrew');
  }
}

function endBattle(world: World, outcome: 'captured' | 'repelled' | 'withdrew'): void {
  const b = world.battle;
  if (b === null) return;
  world.lastBattle = { ...b, endTick: world.tick, outcome };
  world.battle = null;
}

/** Rule 8. */
function capture(world: World, rich: number): void {
  const g = world.guardian;
  if (g.thorns.length > 0) return;
  let present = 0;
  for (const s of world.ships) if (s.at === rich) present++;
  if (present === 0) return;
  g.alive = false;
  g.regrowProgress = 0;
  const node = world.nodes[rich]!;
  node.owned = true;
  node.extractors = Math.min(world.tun['rich.freeExtractors'], node.slots);
  world.capturedTick = world.tick;
  // Capture without a fought round (thorns and ships traded out to zero, then a ship arrived before regrowth).
  if (world.battle === null) world.battle = { startTick: world.tick, shipsEngaged: present, shipsLost: 0, thornsKilled: 0 };
  endBattle(world, 'captured');
}

/** Rule 9. */
function regrowth(world: World): void {
  const g = world.guardian;
  if (g.thorns.length >= world.tun['guardian.cap']) {
    g.regrowProgress = 0;
    return;
  }
  g.regrowProgress += 1;
  if (g.regrowProgress >= world.tun['guardian.regrowTicks']) {
    addThorn(world);
    g.regrowProgress = 0;
  }
}

/** Sum of the delivery ring buffer: ore delivered over the last window (a minute at the fixed 60 s window). */
export function deliveredInWindow(world: Readonly<World>): number {
  let sum = 0;
  for (const b of world.stats.deliveredBuckets) sum += b;
  return sum;
}

/** Rule 10. */
function stats(world: World): void {
  const st = world.stats;
  const sum = deliveredInWindow(world);
  if (sum > st.peakPerMin) st.peakPerMin = sum;
  // The next tick starts a new game second: clear the bucket it will write to.
  const next = world.tick + 1;
  if (next % world.tickRate === 0) {
    st.deliveredBuckets[Math.floor(next / world.tickRate) % st.deliveredBuckets.length] = 0;
  }
}

/** Advances the world by one tick, applying `inputs` first (rule 1). Throws if `data` is for a different data version. */
export function step(world: World, data: SimData, inputs: readonly Input[]): void {
  if (world.dataVersion !== data.dataVersion) {
    throw new Error(`World is data version ${world.dataVersion}, data is ${data.dataVersion}`);
  }
  for (const input of inputs) applyInput(world, data, input);
  construction(world);
  extraction(world);
  routes(world);
  shipyard(world);
  movement(world);
  if (world.guardian.alive) {
    const rich = richIndex(world);
    combat(world, rich);
    capture(world, rich);
    if (world.guardian.alive) regrowth(world);
  }
  stats(world);
  world.tick += 1;
}
