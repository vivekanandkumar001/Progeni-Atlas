/** Stable de-duplication by a derived key, preserving API order. */
export function uniqueBy<T>(
  items: readonly T[] | null | undefined,
  keyOf: (item: T) => string | number | null | undefined
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items ?? []) {
    const rawKey = keyOf(item);
    if (rawKey === null || rawKey === undefined || rawKey === '') {
      result.push(item);
      continue;
    }
    const key = String(rawKey);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}
