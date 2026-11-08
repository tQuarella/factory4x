import { campaignWorld, type CampaignStart } from './campaign.ts';
import type { SimData } from './data.ts';
import { hashState } from './hash.ts';
import type { Input } from './inputs.ts';
import { step } from './step.ts';
import { createWorld, type World } from './world.ts';

/** Seed + data version + input log: enough to replay a game exactly (with the matching data). */
export interface Replay {
  seed: number;
  dataVersion: number;
  /**
   * Optional constructed start (tests, tools and dev hooks only; the game always starts from createWorld):
   * the replay starts from campaignWorld(seed, data, start) instead of createWorld(seed, data).
   */
  start?: CampaignStart;
  /** Each input is applied on the step where world.tick === tick, in log order. */
  inputs: Array<{ tick: number; input: Input }>;
}

/** Fingerprint of all world state (FNV-1a over canonical sorted-key JSON). */
export function worldHash(world: Readonly<World>): string {
  return hashState(world);
}

/** Runs a replay for `ticks` ticks, returning the state hash every `every` ticks. Throws if the replay's dataVersion differs from `data`. */
export function replayHashes(replay: Replay, data: SimData, ticks: number, every: number): string[] {
  if (replay.dataVersion !== data.dataVersion) {
    throw new Error(`Replay is data version ${replay.dataVersion}, data is ${data.dataVersion}`);
  }
  const world = replay.start === undefined ? createWorld(replay.seed, data) : campaignWorld(replay.seed, data, replay.start);
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
