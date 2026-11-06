/**
 * Render-time interpolation between sim ticks. Pure; the sim state is never
 * touched. `alpha` is how far the render clock is into the current tick (0..1).
 */

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Progress 0..1 of something with `ticksLeft` of `totalTicks` remaining, smoothed by alpha. Safe when totalTicks is 0. */
export function progressFrac(ticksLeft: number, totalTicks: number, alpha: number): number {
  if (totalTicks <= 0) return 1;
  return clamp01((totalTicks - ticksLeft + clamp01(alpha)) / totalTicks);
}

/**
 * Total flight ticks of a pod, as the sim computes at launch: ceil(length / speed).
 * Pods carry no totalTicks, and live tuning can change the speed mid-flight, so
 * callers must clamp the resulting fraction (progressFrac does).
 */
export function podTotalTicks(length: number, podSpeedSu: number): number {
  return Math.max(1, Math.ceil(length / Math.max(1, podSpeedSu)));
}

export function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}
