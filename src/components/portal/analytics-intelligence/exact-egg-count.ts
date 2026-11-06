// Egg counts are nonnegative integers. Refuse values and sums that cannot be
// represented exactly in the existing number-based metric contract.
export function isExactEggCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function addExactEggCounts(left: number, right: number): number | null {
  if (!isExactEggCount(left) || !isExactEggCount(right) ||
      right > Number.MAX_SAFE_INTEGER - left) return null;
  return left + right;
}
