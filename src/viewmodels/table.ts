export type SortDir = "asc" | "desc";

/** Stable sort by a number or string key; ties keep their original order. Returns a new array. */
export function sortRows<T>(
  rows: readonly T[],
  value: (row: T) => string | number,
  dir: SortDir,
): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const [x, y] = [value(a), value(b)];
    return (
      sign *
      (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y)))
    );
  });
}
