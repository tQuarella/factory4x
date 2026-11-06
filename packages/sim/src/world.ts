import { nextInt } from './rng.ts';
import { hashState } from './hash.ts';

/**
 * Milestone 0 placeholder world. It exists so the determinism, bot and
 * tick-budget gates exercise real code. The Core Engineer replaces this with
 * entity-component storage in Milestone 1.
 */
export interface SimData {
  dataVersion: number;
  tickRate: number;
  placeholder: { trickleMax: number };
}

export interface World {
  tick: number;
  rng: number;
  dataVersion: number;
  probe: { stock: number };
}

/** Player intent for one tick. Inputs are the only way the outside world affects the sim. */
export type Input = { type: 'noop' } | { type: 'boost'; amount: number };

/** Seed + data version + input log: enough to replay a game exactly. */
export interface Replay {
  seed: number;
  dataVersion: number;
  inputs: Array<{ tick: number; input: Input }>;
}

export function createWorld(seed: number, data: SimData): World {
  return {
    tick: 0,
    rng: seed | 0,
    dataVersion: data.dataVersion,
    probe: { stock: 0 },
  };
}

export function step(world: World, data: SimData, inputs: readonly Input[]): void {
  for (const input of inputs) {
    if (input.type === 'boost') {
      world.probe.stock += input.amount | 0;
    }
  }
  world.probe.stock += nextInt(world, data.placeholder.trickleMax);
  world.tick += 1;
}

export function worldHash(world: World): string {
  return hashState(world);
}

/** Runs a replay for `ticks` ticks, returning the state hash every `every` ticks. */
export function replayHashes(replay: Replay, data: SimData, ticks: number, every: number): string[] {
  const world = createWorld(replay.seed, data);
  const byTick = new Map<number, Input[]>();
  for (const { tick, input } of replay.inputs) {
    const list = byTick.get(tick) ?? [];
    list.push(input);
    byTick.set(tick, list);
  }
  const hashes: string[] = [];
  for (let t = 0; t < ticks; t++) {
    step(world, data, byTick.get(t) ?? []);
    if (world.tick % every === 0) hashes.push(worldHash(world));
  }
  return hashes;
}
