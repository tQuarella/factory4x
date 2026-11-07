import type { SimData } from './data.ts';
import { applyInput, startTransit, type Input } from './inputs.ts';
import { ceilDiv } from './math.ts';
import {
  PROBE,
  addThorn,
  guardianAt,
  guardianParams,
  nodeDistance,
  richIndex,
  routeFrom,
  ticksPerMin,
  type BattleOutcome,
  type BattleResult,
  type Guardian,
  type Ship,
  type Wilt,
  type World,
} from './world.ts';

/**
 * One tick of DESIGN.md H1 "Rules per tick" with the H2 changes, systems in
 * the stated order. Every loop runs over a dense array in id (or node index)
 * order; rules 7-9 each run over all guardians (Bloom, then Root) before the
 * next rule starts.
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

/** Ships parked at `node`, in id order. */
function shipsAt(world: World, node: number): Ship[] {
  const present: Ship[] = [];
  for (const s of world.ships) if (s.at === node) present.push(s);
  return present;
}

/** Rule 7, for one living guardian: a round against the ships at its node, with its effective repair. */
function combat(world: World, g: Guardian): void {
  const t = world.tun;
  let lastShipsDied = false;
  if (world.tick % t['combat.roundTicks'] === 0) {
    const present = shipsAt(world, g.node);
    if (present.length > 0 && g.thorns.length > 0) {
      if (g.battle === null) {
        g.battle = { id: world.nextId++, node: g.node, startTick: world.tick, shipsEngaged: 0, shipsLost: 0, thornsKilled: 0 };
      }
      const battle = g.battle;
      for (const s of present) {
        if (s.engagedIn !== battle.id) {
          s.engagedIn = battle.id;
          battle.shipsEngaged += 1;
        }
      }
      // Both sides' damage comes from counts at the start of the round.
      let playerDamage = present.length * t['ship.damage'];
      let guardDamage = g.thorns.length * t['guardian.thornDamage'];
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
        if (guardDamage <= 0) break;
        const hit = Math.min(guardDamage, s.hp);
        s.hp -= hit;
        guardDamage -= hit;
        if (s.hp <= 0) shipsKilled++;
      }
      if (thornsKilled > 0) g.thorns = g.thorns.filter((th) => th.hp > 0);
      if (shipsKilled > 0) {
        world.ships = world.ships.filter((s) => s.hp > 0);
        lastShipsDied = shipsKilled === present.length;
      }
      battle.thornsKilled += thornsKilled;
      battle.shipsLost += shipsKilled;
      g.thornsKilled += thornsKilled;
      g.shipsLost += shipsKilled;
      world.stats.thornsKilled += thornsKilled;
      world.stats.shipsLost += shipsKilled;
    }
    // Repair on every round tick, fight or not.
    const maxHp = t['guardian.thornHp'];
    const repair = guardianParams(world, g).repairPerRound;
    for (const th of g.thorns) if (th.hp < maxHp) th.hp = Math.min(th.hp + repair, maxHp);
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

/** The wilt (rule 8, Root): drop the Bloom's newest thorns down to the starved cap. Counted as withered, not killed. */
function wilt(world: World): Wilt | null {
  const bloom = guardianAt(world, richIndex(world))!;
  if (!bloom.alive) return null;
  const from = bloom.thorns.length;
  const cap = world.tun['bloom.starvedCap'];
  // Thorns are in ascending id order, so the newest (highest id) is last.
  while (bloom.thorns.length > cap) {
    bloom.thorns.pop();
    world.stats.thornsWithered += 1;
  }
  bloom.regrowProgress = 0;
  return { from, to: bloom.thorns.length };
}

/** Rule 8, for one living guardian. */
function capture(world: World, g: Guardian): void {
  if (g.thorns.length > 0) return;
  let present = 0;
  for (const s of world.ships) if (s.at === g.node) present++;
  if (present === 0) return;
  g.alive = false;
  g.regrowProgress = 0;
  const node = world.nodes[g.node]!;
  node.owned = true;
  // Capture without a fought round (thorns and ships traded out to zero, or a zero-thorn Root, then a ship arrived).
  if (g.battle === null) {
    g.battle = { id: world.nextId++, node: g.node, startTick: world.tick, shipsEngaged: present, shipsLost: 0, thornsKilled: 0 };
  }
  if (node.kind === 'root') {
    world.stats.rootCutTick = world.tick;
    endBattle(world, g, 'captured', wilt(world));
  } else {
    node.extractors = Math.min(world.tun['rich.freeExtractors'], node.slots);
    world.capturedTick = world.tick;
    endBattle(world, g, 'captured', null);
  }
}

/** Rule 9, for one living guardian, at its effective cap and regrow ticks. */
function regrowth(world: World, g: Guardian): void {
  const p = guardianParams(world, g);
  if (g.thorns.length >= p.cap) {
    g.regrowProgress = 0;
    return;
  }
  g.regrowProgress += 1;
  if (g.regrowProgress >= p.regrowTicks) {
    addThorn(world, g);
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
  const gs = world.guardians;
  if (inputs.length > 0) {
    const wavesBefore = gs.map((g) => g.wavesSent);
    for (const input of inputs) applyInput(world, data, input);
    // Several attack orders on one guarded node in the same tick are one wave ("All" sends one order per source node).
    let extra = 0;
    for (let i = 0; i < gs.length; i++) {
      const over = gs[i]!.wavesSent - (wavesBefore[i]! + 1);
      if (over > 0) {
        gs[i]!.wavesSent -= over;
        extra += over;
      }
    }
    world.stats.wavesSent -= extra;
  }
  construction(world);
  extraction(world);
  routes(world);
  shipyard(world);
  movement(world);
  for (const g of gs) if (g.alive) combat(world, g);
  for (const g of gs) if (g.alive) capture(world, g);
  for (const g of gs) if (g.alive) regrowth(world, g);
  stats(world);
  world.tick += 1;
}
