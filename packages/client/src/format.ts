/** Small pure helpers shared by the HUD, sheets, tuning panel and feedback note. */

/** A value in tenths ("…X10" selector results) as text: 25 -> "2.5", 30 -> "3". */
export function fmt10(v: number): string {
  const whole = Math.trunc(v / 10);
  const frac = Math.abs(v % 10);
  return frac === 0 ? String(whole) : `${whole}.${frac}`;
}

/** Whole seconds as m:ss. */
export function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 7-char sha from a build version such as "dev-<sha>" or "main-12-<sha>"; other strings pass through. */
export function shortVersion(full: string): string {
  const all = full.match(/[0-9a-f]{7,40}/g);
  const last = all?.[all.length - 1];
  return last ? last.slice(0, 7) : full;
}

/** Stepper size for a tunable's range: about 20 taps end to end, in tidy steps. */
export function stepFor(min: number, max: number): number {
  const span = max - min;
  if (span <= 20) return 1;
  if (span <= 60) return 5;
  if (span <= 200) return 10;
  if (span <= 500) return 25;
  return 60;
}

/** Clamp to a tunable's range and round to a whole number. */
export function clampInt(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.round(v)));
}

/** A tick count with its game seconds: 60 at 30 ticks/s -> "60 · 2.0 s". */
export function ticksText(ticks: number, tickRate: number): string {
  return `${ticks} · ${(ticks / tickRate).toFixed(1)} s`;
}
