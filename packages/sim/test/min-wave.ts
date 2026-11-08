import { SHIP_TYPES, createWorld, guardianAt, step, type ShipType, type ShipTypeCounts, type SimData, type World } from '../src/index.ts';
import { fixtureData } from './fixture.ts';

/**
 * The scripted minimum-wave search (h3-sim acceptance 5): the smallest
 * simultaneous wave that captures a guarded node from full strength, with the
 * real sim rules. Ships are placed at the node on tick 0 (a round tick), so
 * they all arrive together; nothing else happens in the world.
 */

/** Ship hard cap for the search; a single type that can't win by then reports null. */
export const SEARCH_MAX = 80;

function placeShips(w: World, node: number, fleet: Readonly<ShipTypeCounts>): void {
  for (const type of SHIP_TYPES) {
    for (let i = 0; i < fleet[type]; i++) {
      w.ships.push({ id: w.nextId++, type, hp: w.tun[`ship.${type}.hp`], at: node, transit: null, engagedIn: -1 });
    }
  }
}

/** A world on `layout` with every yard off; `starved` cuts the Root first (the heart wilts to its starved caps). */
export function baseWorld(layout: number, starved: boolean, data: SimData = fixtureData): World {
  const w = createWorld(layout, data);
  if (w.system.variant !== layout) throw new Error('seed did not pick the layout');
  for (const t of SHIP_TYPES) w.yards[t].on = false;
  if (starved) {
    const root = w.nodes.findIndex((n) => n.kind === 'root');
    placeShips(w, root, { drone: 0, lancer: 200, flak: 200 });
    while (guardianAt(w, root)!.alive) step(w, data, []);
    w.ships = [];
    // Back to a round tick, with the heart full at its starved caps (regrowth is slow but finishes).
    const heart = guardianAt(w, w.nodes.findIndex((n) => n.kind === 'heart'))!;
    let guard = 0;
    while (w.tick % w.tun['combat.roundTicks'] !== 0 || heart.regrowProgress.thorn + heart.regrowProgress.spore > 0) {
      step(w, data, []);
      if (++guard > 100_000) throw new Error('heart never settled');
    }
  }
  return w;
}

/** True if `fleet`, arriving together at `node` of `base`, captures it. */
export function waveWins(base: Readonly<World>, node: number, fleet: Readonly<ShipTypeCounts>, data: SimData = fixtureData): boolean {
  const w = JSON.parse(JSON.stringify(base)) as World;
  placeShips(w, node, fleet);
  const g = guardianAt(w, node)!;
  for (let i = 0; i < 100_000; i++) {
    step(w, data, []);
    if (!g.alive) return true;
    if (!w.ships.some((s) => s.at === node)) return false;
  }
  throw new Error('battle did not end');
}

const only = (type: ShipType, n: number): ShipTypeCounts => ({ drone: 0, lancer: 0, flak: 0, [type]: n });

/** The smallest single-type wave that wins, or null within SEARCH_MAX. */
export function minSingle(base: Readonly<World>, node: number, type: ShipType, data: SimData = fixtureData): number | null {
  for (let n = 1; n <= SEARCH_MAX; n++) if (waveWins(base, node, only(type, n), data)) return n;
  return null;
}

/** The smallest total of any mix of the three types that wins, and one such mix (fewest drones, then fewest lancers). */
export function minMix(base: Readonly<World>, node: number, upTo: number, data: SimData = fixtureData): { total: number; fleet: ShipTypeCounts } | null {
  for (let n = 1; n <= upTo; n++) {
    for (let d = 0; d <= n; d++) {
      for (let l = 0; l <= n - d; l++) {
        const fleet = { drone: d, lancer: l, flak: n - d - l };
        if (waveWins(base, node, fleet, data)) return { total: n, fleet };
      }
    }
  }
  return null;
}

export interface MinWaves {
  drones: number | null;
  lancers: number | null;
  flak: number | null;
  mix: number | null;
  mixFleet: ShipTypeCounts | null;
}

/** All four minimums for one node. */
export function minWaves(base: Readonly<World>, node: number, data: SimData = fixtureData): MinWaves {
  const drones = minSingle(base, node, 'drone', data);
  const lancers = minSingle(base, node, 'lancer', data);
  const flak = minSingle(base, node, 'flak', data);
  const singles = [drones, lancers, flak].filter((v): v is number => v !== null);
  const mix = minMix(base, node, singles.length ? Math.min(...singles) : SEARCH_MAX, data);
  return { drones, lancers, flak, mix: mix?.total ?? null, mixFleet: mix?.fleet ?? null };
}
