import { BUILD_TYPES, createWorld, step, type BuildType, type EconShip, type EconType, type Input, type SimData, type World } from '../src/index.ts';
import { fixtureV12 } from './fixture.ts';

/**
 * h7-sim test helpers for field mode (DESIGN.md H7). Rule tests run on the frozen v12 fixture, whose map.field
 * is the shipped one (data-h7.test.ts checks it), so calibration never breaks them.
 */
export const FD: SimData = fixtureV12;

/** Node indices of the field: its nodes in frame order. */
export const F = { probe: 0, a1: 1, a2: 2, a3: 3, a4: 4, a5: 5, a6: 6, a7: 7, p1: 8, p2: 9, heart: 10 } as const;

/** A fresh field run (F13 landing). */
export function fieldWorld(d: SimData = FD, seed = 1): World {
  return createWorld(seed, d);
}

/**
 * A field world where nothing happens unless the test sets it up: no stock, no probe mining, every weight 0,
 * no Mine marks.
 */
export function quietField(d: SimData = FD): World {
  const w = fieldWorld(d);
  const f = w.field!;
  w.stock.ore = 0;
  w.tun['economy.probeOrePerMin'] = 0;
  for (const t of BUILD_TYPES) f.alloc[t] = 0;
  f.mine = f.mine.map(() => false);
  return w;
}

/** One tick with these inputs. */
export function tick(w: World, ...inputs: Input[]): void {
  step(w, FD, inputs);
}

/** `n` ticks with no inputs. */
export function run(w: World, n: number): void {
  for (let i = 0; i < n; i++) step(w, FD, []);
}

/** Steps until `pred` holds (or throws after `max` ticks); returns the ticks stepped. */
export function runUntil(w: World, pred: (w: World) => boolean, max: number): number {
  let i = 0;
  while (!pred(w)) {
    if (i >= max) throw new Error(`condition not met within ${max} ticks`);
    step(w, FD, []);
    i++;
  }
  return i;
}

/** Test setup: an economy ship parked at `at`, with an optional target (extractor: bound node; hauler: assigned). */
export function addEcon(w: World, type: EconType, at: number, target: number | null = null): EconShip {
  const s: EconShip = { id: w.nextId++, type, hp: w.tun[`ship.${type}.hp`], at, transit: null, target, cargo: 0, cargoRes: null };
  w.field!.econ.push(s);
  return s;
}

/** A weight record for setAlloc tests: weights in BUILD_TYPES order. */
export function weights(e: number, h: number, d: number, l: number, f: number): Record<BuildType, number> {
  return { extractor: e, hauler: h, drone: d, lancer: l, flak: f };
}

/** The setAlloc inputs that set every weight. */
export function setAll(wts: Readonly<Record<BuildType, number>>): Input[] {
  return BUILD_TYPES.map((shipType) => ({ type: 'setAlloc', shipType, weight: wts[shipType] }));
}

/** Docked extractors per node (node.extractors minus free). */
export function docked(w: World): number[] {
  return w.nodes.map((n) => n.extractors - w.field!.free[n.index]!);
}
