import {
  createWorld,
  defaultData,
  deserializeWorld,
  isValidInput,
  nodeStatus,
  serializeWorld,
  step,
  type Input,
  type SimData,
  type World,
} from '../src/index.ts';

export const data = defaultData;

/** Node indices of the M1 map. */
export const N = { probe: 0, a1: 1, a2: 2, a3: 3, a4: 4, a5: 5, rich: 6 } as const;

/** Steps `n` ticks with no inputs. */
export function run(world: World, n: number, d: SimData = data): void {
  for (let i = 0; i < n; i++) step(world, d, []);
}

/** Steps until `pred` holds or `max` ticks pass; returns ticks stepped. */
export function runUntil(world: World, pred: (w: World) => boolean, max: number, d: SimData = data): number {
  let i = 0;
  while (!pred(world) && i < max) {
    step(world, d, []);
    i++;
  }
  if (!pred(world)) throw new Error(`condition not met within ${max} ticks`);
  return i;
}

/** Deep copy via the save format (also exercises it). */
export function clone(world: World): World {
  const r = deserializeWorld(serializeWorld(world), data);
  if (!r.ok) throw new Error('clone failed');
  return r.world;
}

/** Parks `n` new ships at `node` (test setup only). */
export function addShips(w: World, node: number, n: number): void {
  for (let i = 0; i < n; i++) w.ships.push({ id: w.nextId++, hp: w.tun['ship.hp'], at: node, transit: null, engagedIn: -1 });
}

export function fresh(seed = 1): World {
  return createWorld(seed, data);
}

/**
 * A fixed economy script (the turtle plan from DESIGN.md, one queued item at a
 * time): for a1..a5 in order, extractor, route, upgrade when committed extraction
 * exceeds capacity, then fill the slots. Returns the next input or null.
 */
export function networkStep(w: World): Input | null {
  if (w.queue.length > 0) return null;
  for (const n of [N.a1, N.a2, N.a3, N.a4, N.a5]) {
    const st = nodeStatus(w, n);
    const tries: Input[] = [];
    if (st.extractorsCommitted === 0) tries.push({ type: 'buildExtractor', node: n });
    if (!st.route && !st.routePending) tries.push({ type: 'buildRoute', from: n, to: N.probe });
    const committedPerMin = st.extractorsCommitted * w.tun['extractor.orePerMin'];
    if (st.route) {
      const capWithPending = st.route.capacityPerMin + st.route.pendingUpgrades * (st.route.capacityPerMin / st.route.level);
      if (committedPerMin > capWithPending) tries.push({ type: 'upgradeRoute', from: n });
    }
    if (st.extractorsCommitted < st.slots) tries.push({ type: 'buildExtractor', node: n });
    for (const t of tries) if (isValidInput(w, data, t)) return t;
  }
  return null;
}

/** True when the network script has nothing left to build. */
export function networkDone(w: World): boolean {
  return networkStep(w) === null && w.queue.length === 0 && w.activeBuild === null;
}
