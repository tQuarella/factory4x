import {
  SHIP_TYPES,
  createWorld,
  defaultData,
  deserializeWorld,
  guardianAt,
  isValidInput,
  nodeStatus,
  serializeWorld,
  step,
  type GuardType,
  type Guardian,
  type Input,
  type ShipType,
  type SimData,
  type World,
} from '../src/index.ts';

export const data = defaultData;

/** Node indices of the H3 map. */
export const N = {
  probe: 0,
  a1: 1,
  a2: 2,
  a3: 3,
  a4: 4,
  a5: 5,
  a6: 6,
  a7: 7,
  a8: 8,
  a9: 9,
  p1: 10,
  p2: 11,
  p3: 12,
  p4: 13,
  root: 14,
  heart: 15,
} as const;

/** Layout indices; seeds 0, 1, 2 pick them in order. */
export const L = { frost: 0, glass: 1, twin: 2 } as const;

/** The guardian at a node (throws if none). */
export function guardian(w: World, node: number): Guardian {
  const g = guardianAt(w, node);
  if (g === null) throw new Error(`no guardian at ${node}`);
  return g;
}

/** The heart's guardian. */
export function heart(w: World): Guardian {
  return guardian(w, N.heart);
}

/** The Root's guardian. */
export function root(w: World): Guardian {
  return guardian(w, N.root);
}

/** Replaces a guardian's guards with these (type, hp) pairs, new ids in order. Test setup only. */
export function setGuards(w: World, node: number, guards: ReadonlyArray<readonly [GuardType, number]>): void {
  guardian(w, node).guards = guards.map(([type, hp]) => ({ id: w.nextId++, type, hp }));
}

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

/** Parks `n` new ships of `type` at `node` (test setup only). */
export function addShips(w: World, node: number, n: number, type: ShipType = 'drone'): void {
  for (let i = 0; i < n; i++) w.ships.push({ id: w.nextId++, type, hp: w.tun[`ship.${type}.hp`], at: node, transit: null, engagedIn: -1 });
}

export function fresh(seed = 0): World {
  return createWorld(seed, data);
}

/** No stock, no probe mining, every yard off: nothing happens unless the test sets it up. */
export function idle(seed = 0): World {
  const w = fresh(seed);
  w.stock.ore = 0;
  for (const t of SHIP_TYPES) w.yards[t].on = false;
  w.tun['economy.probeOrePerMin'] = 0;
  return w;
}

/**
 * A fixed economy script (the turtle plan, one queued item at a time): for
 * a1..a5 in order, extractor, route, upgrade when committed extraction
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
