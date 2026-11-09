import {
  SHIP_TYPES,
  campaignWorld,
  guardianAt,
  step,
  type CampaignStart,
  type ShipType,
  type ShipTypeCounts,
  type SimData,
  type World,
} from '@factory4x/sim';

/**
 * The minimum-wave probe (DESIGN.md H5 "Bots: strategies and the probe"): the smallest simultaneous wave that
 * captures a guarded node from full strength, with the real sim rules. Ships are placed at the node on a round
 * tick, so they arrive together; nothing else happens in the world. Copied from packages/sim/test/min-wave.ts
 * (a test helper the bots package can't import) and extended with the best mix of locally buildable types.
 *
 * Search assumption: adding a ship never turns a win into a loss (the tests check it on a fixture).
 */

/** Ship cap for a single-type search; a type that can't win by then reports null. */
export const SEARCH_MAX = 80;

function placeShips(w: World, node: number, fleet: Readonly<ShipTypeCounts>): void {
  for (const type of SHIP_TYPES) {
    for (let i = 0; i < fleet[type]; i++) {
      w.ships.push({ id: w.nextId++, type, hp: w.tun[`ship.${type}.hp`], at: node, transit: null, engagedIn: -1 });
    }
  }
}

/** The area landed from a campaign where every other area is reclaimed and both designs are bought, every yard off; `starved` cuts the Root first. */
export function probeWorld(seed: number, data: SimData, areaId: string, starved: boolean): World {
  const reclaimed = data.map.areas.map((a) => a.id).filter((id) => id !== areaId);
  const w = campaignWorld(seed, data, { reclaimed, research: { lancer: 1, flak: 1 }, land: areaId });
  for (const t of SHIP_TYPES) w.yards[t].on = false;
  if (starved) {
    const root = w.nodes.findIndex((n) => n.kind === 'root');
    if (root < 0) throw new Error(`probeWorld: ${areaId} has no Root to cut`);
    placeShips(w, root, { drone: 0, lancer: 200, flak: 200 });
    while (guardianAt(w, root)!.alive) step(w, data, []);
    w.ships = [];
    // Back to a round tick with the heart full at its starved caps (regrowth is slow but finishes).
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
export function waveWins(base: Readonly<World>, node: number, fleet: Readonly<ShipTypeCounts>, data: SimData): boolean {
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

/**
 * True if these ships, in this order (the order sets their ids, and a battle's damage falls on ships in id order, so a
 * wave that wins with its lancers first can lose with its flak first), each at its hp, arriving together at `node` of
 * `base`, capture it. The live check the composer makes before it sends a wave.
 */
export function shipsWin(base: Readonly<World>, node: number, ships: ReadonlyArray<Readonly<{ type: ShipType; hp: number }>>, data: SimData): boolean {
  const w = JSON.parse(JSON.stringify(base)) as World;
  for (const s of ships) w.ships.push({ id: w.nextId++, type: s.type, hp: s.hp, at: node, transit: null, engagedIn: -1 });
  const g = guardianAt(w, node)!;
  for (let i = 0; i < 100_000; i++) {
    step(w, data, []);
    if (!g.alive) return true;
    if (!w.ships.some((s) => s.at === node)) return false;
  }
  throw new Error('battle did not end');
}

const only = (type: ShipType, n: number): ShipTypeCounts => ({ drone: 0, lancer: 0, flak: 0, [type]: n });

/** The smallest single-type wave that wins, or null within `max`. */
export function minSingle(base: Readonly<World>, node: number, type: ShipType, data: SimData, max = SEARCH_MAX): number | null {
  for (let n = 1; n <= max; n++) if (waveWins(base, node, only(type, n), data)) return n;
  return null;
}

/**
 * The smallest total of a mix of the `allowed` types that wins (at most `upTo` ships), and one such mix: the
 * first in the order fewest drones, then fewest lancers. Null if nothing within `upTo` wins.
 *
 * Phase 1 finds the minimum total N from the monotone assumption: for each (lancers, flak) pair, one battle
 * with the most drones that could still beat the best total so far decides whether the pair improves on it.
 * Phase 2 walks the mixes of total N in the fixed order.
 */
export function minMix(
  base: Readonly<World>,
  node: number,
  allowed: readonly ShipType[],
  upTo: number,
  data: SimData,
): { total: number; fleet: ShipTypeCounts } | null {
  const canL = allowed.includes('lancer');
  const canF = allowed.includes('flak');
  const canD = allowed.includes('drone');
  let best: number | null = null;
  for (let l = 0; l <= (canL ? upTo : 0); l++) {
    for (let f = 0; f <= (canF ? upTo - l : 0); f++) {
      const room = (best === null ? upTo : best - 1) - l - f;
      if (room < 0) continue;
      const dMax = canD ? room : 0;
      if (!waveWins(base, node, { drone: dMax, lancer: l, flak: f }, data)) continue;
      // The fewest drones that still win (monotone): binary search in [0, dMax].
      let lo = 0;
      let hi = dMax;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (waveWins(base, node, { drone: mid, lancer: l, flak: f }, data)) hi = mid;
        else lo = mid + 1;
      }
      best = l + f + lo;
    }
  }
  if (best === null) return null;
  for (let d = 0; d <= (canD ? best : 0); d++) {
    for (let l = 0; l <= (canL ? best - d : 0); l++) {
      const f = best - d - l;
      if (f < 0 || (f > 0 && !canF)) continue;
      const fleet = { drone: d, lancer: l, flak: f };
      if (waveWins(base, node, fleet, data)) return { total: best, fleet };
    }
  }
  throw new Error('minMix: the minimum total was not found again');
}

/** The probe's limits (DESIGN.md "Capability windows"; H6: one fleet.relayStep per commanded band): L0 = fleet.cap, L1 = L0 + step, L2 = L0 + 2 × step. */
export interface ProbeLimits {
  l0: number;
  l1: number;
  l2: number;
}

export function probeLimits(data: SimData): ProbeLimits {
  const l0 = data.tunables['fleet.cap'].default;
  const stepSize = data.tunables['fleet.relayStep'].default;
  return { l0, l1: l0 + stepSize, l2: l0 + 2 * stepSize };
}

/** Ship types an area can build locally: drones always, lancers with a crystal prize, flak with an ice prize (both designs assumed). The Deep has both prizes in every layout. */
export function locallyBuildable(data: SimData, areaId: string): ShipType[] {
  const area = data.map.areas.find((a) => a.id === areaId)!;
  if (area.layout === 'seed') return ['drone', 'lancer', 'flak'];
  const prizes = new Set<string>(Object.values(area.layout.pockets).map((p) => p.prize));
  const out: ShipType[] = ['drone'];
  if (prizes.has('crystal')) out.push('lancer');
  if (prizes.has('ice')) out.push('flak');
  return out;
}

export interface HeartProbe {
  area: string;
  tier: number;
  /** `starved` is the Root-cut state (dormant since H6: no shipped area has a Root, so every shipped row is `fed`). */
  state: 'fed' | 'starved';
  /** H6: a command relay. */
  relay: boolean;
  /** H6, tier 2 only: the smallest drones-alone wave that takes the area's first pocket (null: none within the search cap); absent elsewhere. */
  pocketDrones?: number | null;
  /** The Deep's layout name (else null), and the seed that chose it. */
  layout: string | null;
  seed: number;
  drones: number | null;
  lancers: number | null;
  flak: number | null;
  buildable: ShipType[];
  /** Minimum winning total of the locally buildable types, and one such fleet. */
  mix: number | null;
  mixFleet: ShipTypeCounts | null;
}

/** Probe one heart. `seed` picks The Deep's layout. */
export function probeHeart(seed: number, data: SimData, areaId: string, starved: boolean): HeartProbe {
  const w = probeWorld(seed, data, areaId, starved);
  const node = w.nodes.findIndex((n) => n.kind === 'heart');
  const lim = probeLimits(data);
  const buildable = locallyBuildable(data, areaId);
  const mix = minMix(w, node, buildable, lim.l2 + 6, data);
  const def = data.map.areas.find((a) => a.id === areaId)!;
  const pocket = w.nodes.findIndex((n) => n.kind === 'pocket');
  const row: HeartProbe = {
    area: areaId,
    tier: def.tier,
    relay: def.relay === true,
    state: starved ? 'starved' : 'fed',
    layout: areaId === 'deep' ? w.system.name : null,
    seed,
    drones: minSingle(w, node, 'drone', data),
    lancers: minSingle(w, node, 'lancer', data),
    flak: minSingle(w, node, 'flak', data),
    buildable,
    mix: mix?.total ?? null,
    mixFleet: mix?.fleet ?? null,
  };
  if (def.tier === 2 && pocket >= 0) row.pocketDrones = minSingle(w, pocket, 'drone', data);
  return row;
}

/** Every tier >= 1 heart, fed and (where there is a Root) starved; The Deep once per seed in 1..seeds, since the seed picks its layout. Progress is reported per row. */
export function probeAll(data: SimData, seeds: number, progress: (row: HeartProbe) => void = () => {}): HeartProbe[] {
  const rows: HeartProbe[] = [];
  for (const area of data.map.areas) {
    if (area.tier < 1) continue;
    // h6-sim: read it from the area's nodes; since data v10 no area, The Deep included, has the Root.
    const hasRoot = area.nodes.some((id) => data.map.nodes.find((n) => n.id === id)?.kind === 'root');
    const seedList = area.layout === 'seed' ? Array.from({ length: seeds }, (_, i) => i + 1) : [1];
    for (const seed of seedList) {
      for (const starved of hasRoot ? [false, true] : [false]) {
        const row = probeHeart(seed, data, area.id, starved);
        rows.push(row);
        progress(row);
      }
    }
  }
  return rows;
}

/** Window cells (DESIGN.md "Capability windows"): fits at L when the minimum winning wave of buildable types is at most L − 2; closed at L when it is above L (no win within the search counts as closed). */
export const fitsAt = (mix: number | null, limit: number): boolean => mix !== null && mix <= limit - 2;
export const closedAt = (mix: number | null, limit: number): boolean => mix === null || mix > limit;

/** Closed to one type at L (the drones-alone cells): that type's minimum is above L, or not found. */
export const singleClosedAt = (single: number | null, limit: number): boolean => single === null || single > limit;
export const singleFitsAt = (single: number | null, limit: number): boolean => single !== null && single <= limit - 2;

export interface WindowCheck {
  name: string;
  met: boolean;
}

/**
 * The capability windows (DESIGN.md H6 "Capability windows") that apply to a probe row, each met or missed. Every
 * heart is fed. Tier 1: a plain light area fits at L0 with drones alone; a relay is closed to drones alone at L0 and
 * fits at L0 with its side's counter. Tier 2: closed at L0 with any local mix, fits at L1, no single type fits at L1,
 * the relays bind at L1 (best mix >= L1 - 6) and the first pocket falls to drones alone within L1. Tier 3: closed at
 * L1, fits at L2, no single type fits at L2, binds at L2 (best mix >= L2 - 6).
 */
export function windowChecks(row: HeartProbe, L: ProbeLimits): WindowCheck[] {
  const w = (name: string, met: boolean): WindowCheck => ({ name, met });
  const noSingleFits = (limit: number): boolean => ![row.drones, row.lancers, row.flak].some((v) => singleFitsAt(v, limit));
  const binds = (limit: number): boolean => row.mix !== null && row.mix >= limit - 6;
  if (row.tier === 1 && !row.relay) return [w(`fits L0 (${L.l0}) with drones`, singleFitsAt(row.drones, L.l0))];
  if (row.tier === 1) return [w(`drones closed at L0 (${L.l0})`, singleClosedAt(row.drones, L.l0)), w(`fits L0 (${L.l0}) with its counter`, fitsAt(row.mix, L.l0))];
  if (row.tier === 2) {
    const out = [w(`closed at L0 (${L.l0})`, closedAt(row.mix, L.l0)), w(`fits L1 (${L.l1})`, fitsAt(row.mix, L.l1)), w('no single type fits L1', noSingleFits(L.l1))];
    if (row.relay) out.push(w(`binds at L1 (mix >= ${L.l1 - 6})`, binds(L.l1)));
    out.push(w(`first pocket falls to drones within L1 (${L.l1})`, row.pocketDrones !== undefined && row.pocketDrones !== null && row.pocketDrones <= L.l1));
    return out;
  }
  return [
    w(`closed at L1 (${L.l1})`, closedAt(row.mix, L.l1)),
    w(`fits L2 (${L.l2})`, fitsAt(row.mix, L.l2)),
    w('no single type fits L2', noSingleFits(L.l2)),
    w(`binds at L2 (mix >= ${L.l2 - 6})`, binds(L.l2)),
  ];
}

// ---------------------------------------------------------------------------------------------------------------------
// Trial visits (DESIGN.md H6 "Bots (H6)"): the lock tested by real play, not by the probe's arithmetic.
// ---------------------------------------------------------------------------------------------------------------------

/** The three trial kinds: every band 2 area at L0 with both designs, every Deep layout at L1 with both designs, every band 1 relay at L0 with drones only. */
export type TrialKind = 'band2-l0' | 'deep-l1' | 'relay-drones';

export interface Trial {
  kind: TrialKind;
  area: string;
  /** Picks The Deep's layout (otherwise 1). */
  seed: number;
  /** The fleet limit the visit should get (L0 or L1 at the shipped tunables). */
  limit: number;
  dronesOnly: boolean;
  start: CampaignStart;
}

/** The ids joined to `areaId` by a lane, in lane order. */
function laneIds(data: SimData, areaId: string): string[] {
  return data.map.lanes.flatMap(([x, y]) => (x === areaId ? [y] : y === areaId ? [x] : []));
}

/**
 * The start of a trial: Landfall and the plain light areas reclaimed (no relay, so L0), plus whatever lane-joins the
 * target; both designs bought. `campaignWorld` lands behind the band lock (h6-sim), which is the point. A band 2
 * area's trial reclaims a non-relay neighbour to join its lane, so the limit stays L0. The Deep's reclaims one band 2
 * relay next to it, which commands one band: L1.
 */
export function trialStart(data: SimData, kind: TrialKind, areaId: string): CampaignStart {
  const base = data.map.areas.filter((a) => a.tier === 0 || (a.tier === 1 && !a.relay)).map((a) => a.id);
  const research = { lancer: 1, flak: 1 } as const;
  if (kind === 'relay-drones') return { reclaimed: base, research, land: areaId };
  const isRelay = (id: string): boolean => data.map.areas.find((a) => a.id === id)?.relay === true;
  if (kind === 'band2-l0') {
    const via = laneIds(data, areaId).find((id) => !isRelay(id));
    return { reclaimed: via === undefined || base.includes(via) ? base : [...base, via], research, land: areaId };
  }
  const relay = laneIds(data, areaId).find(isRelay);
  if (relay === undefined) throw new Error(`trialStart: ${areaId} has no relay neighbour`);
  return { reclaimed: [...base, relay], research, land: areaId };
}

/** Every trial: band 2 areas at L0, The Deep once per seed in 1..seeds at L1, band 1 relays with drones only. Data order within each kind. */
export function trialSpecs(data: SimData, seeds: number): Trial[] {
  const l = probeLimits(data);
  const out: Trial[] = [];
  for (const a of data.map.areas) {
    if (a.tier === 2) out.push({ kind: 'band2-l0', area: a.id, seed: 1, limit: l.l0, dronesOnly: false, start: trialStart(data, 'band2-l0', a.id) });
  }
  for (const a of data.map.areas) {
    if (a.tier !== 3) continue;
    const seedList = a.layout === 'seed' ? Array.from({ length: seeds }, (_, i) => i + 1) : [1];
    for (const seed of seedList) out.push({ kind: 'deep-l1', area: a.id, seed, limit: l.l1, dronesOnly: false, start: trialStart(data, 'deep-l1', a.id) });
  }
  for (const a of data.map.areas) {
    if (a.tier === 1 && a.relay) out.push({ kind: 'relay-drones', area: a.id, seed: 1, limit: l.l0, dronesOnly: true, start: trialStart(data, 'relay-drones', a.id) });
  }
  return out;
}
