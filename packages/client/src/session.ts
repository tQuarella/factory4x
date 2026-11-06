/**
 * One play session: the world, the fixed-step clock, the input log and the
 * client-only time controls. No DOM here, so it is unit-testable in Node.
 *
 * Replay invariant: `replay()` (seed + dataVersion + optional startTunables + input log) re-run from
 * tick 0 up to `world.tick` reproduces `worldHash(world)`. Every input is
 * logged with the tick of the step that applied it. Inputs sent but not yet
 * stepped sit in `pending` and are saved with the world (see persist.ts).
 */
import {
  createWorld,
  defaultData,
  tunableMeta,
  isValidInput,
  step,
  throughputPerMin,
  type Input,
  type Replay,
  type SimData,
  type World,
} from '@factory4x/sim';

/** Sim tunable values a run started with, where they differ from the data defaults (New run keeps live tuning). */
export type StartTunables = Record<string, number>;

/** Data whose sim-tunable defaults are replaced by `values` (clamped to range); other keys are ignored. */
export function dataWithDefaults(base: SimData, values: Readonly<Record<string, number>>): SimData {
  const tunables = { ...base.tunables };
  for (const m of tunableMeta(base)) {
    const v = values[m.key];
    if (m.scope !== 'sim' || v === undefined || !Number.isInteger(v)) continue;
    tunables[m.key] = { ...tunables[m.key], default: Math.min(m.max, Math.max(m.min, v)) };
  }
  return { ...base, tunables };
}

/** Sim tunable defaults of `data` that differ from the shipped defaults. */
export function defaultsDiff(data: SimData): StartTunables {
  const out: StartTunables = {};
  for (const m of tunableMeta(defaultData)) {
    if (m.scope === 'sim' && data.tunables[m.key].default !== m.default) out[m.key] = data.tunables[m.key].default;
  }
  return out;
}

/** The data a replay ran on: shipped data plus its start tunables. */
export function replayData(replay: Replay & { startTunables?: StartTunables }): SimData {
  return dataWithDefaults(defaultData, replay.startTunables ?? {});
}

export type Speed = 1 | 2 | 4;

export interface LoggedInput {
  tick: number;
  input: Input;
}

/** Throughput samples kept for the probe sheet sparkline: 10 game minutes, one per game second. */
export const HISTORY_SECONDS = 600;
/** Longest wall-clock gap one frame may simulate; a stalled tab doesn't fast-forward. */
const MAX_FRAME_MS = 250;

/** Per-run flags that survive a resume (so a toast or panel isn't shown twice). */
export interface RunFlags {
  /** endTick of the last battle whose report toast was shown, or -1. */
  seenBattleEnd: number;
  resultShown: boolean;
}

export interface SessionInit {
  seed: number;
  world?: World;
  log?: LoggedInput[];
  pending?: Input[];
  history?: number[];
  flags?: RunFlags;
}

export class Session {
  readonly data: SimData;
  readonly seed: number;
  world: World;
  log: LoggedInput[];
  pending: Input[];
  history: number[];
  flags: RunFlags;
  paused = false;
  speed: Speed = 1;
  /** Milliseconds accumulated toward the next tick. */
  acc = 0;
  /** Bumped when a combat round has just resolved, for the hit flash. */
  hitSeq = 0;

  constructor(data: SimData, init: SessionInit) {
    this.data = data;
    this.seed = init.seed;
    this.world = init.world ?? createWorld(init.seed, data);
    this.log = init.log ?? [];
    this.pending = init.pending ?? [];
    this.history = init.history ?? [];
    this.flags = init.flags ?? { seenBattleEnd: -1, resultShown: false };
  }

  get tickMs(): number {
    return 1000 / this.data.tickRate;
  }

  /** 0..1 into the current tick, for interpolation. Frozen while paused. */
  get alpha(): number {
    return Math.min(1, this.acc / this.tickMs);
  }

  /**
   * Sends one player input. Invalid ones (a stale tap) are dropped and not
   * logged. While paused, the input is applied at once by stepping a single
   * tick, so the screen reflects it; the log records it like any other.
   */
  send(input: Input): boolean {
    if (!isValidInput(this.world, this.data, input)) return false;
    this.pending.push(input);
    if (this.paused) this.stepOnce();
    return true;
  }

  /** Advances the fixed-step clock by wall time `dtMs` at the current speed. No-op while paused. Returns ticks stepped. */
  advance(dtMs: number): number {
    if (this.paused) return 0;
    this.acc += Math.min(Math.max(dtMs, 0), MAX_FRAME_MS) * this.speed;
    let n = 0;
    while (this.acc >= this.tickMs) {
      this.acc -= this.tickMs;
      this.stepOnce();
      n++;
    }
    return n;
  }

  /** One sim tick, applying (and logging) every pending input. */
  stepOnce(): void {
    const inputs = this.pending;
    this.pending = [];
    for (const input of inputs) this.log.push({ tick: this.world.tick, input });
    step(this.world, this.data, inputs);
    const w = this.world;
    if (w.battle !== null && (w.tick - 1) % w.tun['combat.roundTicks'] === 0) this.hitSeq++;
    if (w.tick % w.tickRate === 0) {
      this.history.push(throughputPerMin(w));
      if (this.history.length > HISTORY_SECONDS) this.history.splice(0, this.history.length - HISTORY_SECONDS);
    }
  }

  /** Seed + data version + input log: reproduces this session's world at `world.tick`. */
  replay(): Replay & { startTunables?: StartTunables } {
    const r: Replay & { startTunables?: StartTunables } = {
      seed: this.seed,
      dataVersion: this.data.dataVersion,
      inputs: this.log.map((l) => ({ tick: l.tick, input: l.input })),
    };
    const diff = defaultsDiff(this.data);
    if (Object.keys(diff).length > 0) r.startTunables = diff;
    return r;
  }
}
