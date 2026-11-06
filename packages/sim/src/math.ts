/**
 * Integer helpers. All inputs are non-negative integers well below 2^31, so
 * every intermediate value is an exact double and the results are identical
 * in every JS engine.
 */

/** floor(sqrt(n)) for a non-negative integer n < 2^52, by Newton's method on integers. */
export function isqrt(n: number): number {
  if (n < 2) return n;
  let x = n;
  let y = Math.floor((x + 1) / 2);
  while (y < x) {
    x = y;
    y = Math.floor((x + Math.floor(n / x)) / 2);
  }
  return x;
}

/** ceil(a / b) for a ≥ 0, b > 0. */
export function ceilDiv(a: number, b: number): number {
  return Math.floor((a + b - 1) / b);
}
