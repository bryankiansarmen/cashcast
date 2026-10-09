export type IsoDate = string; // YYYY-MM-DD
export type DateResult = { ok: true; value: IsoDate } | { ok: false; error: string };

const MS_PER_DAY = 86_400_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const US = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

const utc = (y: number, m: number, d: number) => new Date(0).setUTCFullYear(y, m - 1, d);
const pad = (n: number, width: number) => String(n).padStart(width, "0");

/** Days since 1970-01-01 for a valid IsoDate. */
export const toDayNumber = (iso: IsoDate): number => {
  const [y, m, d] = iso.split("-").map(Number);
  return utc(y, m, d) / MS_PER_DAY;
};

export const fromDayNumber = (n: number): IsoDate => {
  const d = new Date(n * MS_PER_DAY);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}`;
};

export const addDays = (iso: IsoDate, days: number): IsoDate =>
  fromDayNumber(toDayNumber(iso) + days);

/** Whole days from b to a (a minus b). */
export const diffDays = (a: IsoDate, b: IsoDate): number => toDayNumber(a) - toDayNumber(b);

/** Accepts YYYY-MM-DD or M/D/YYYY; returns the normalized ISO date. */
export function parseDate(text: string): DateResult {
  const s = text.trim();
  const iso = ISO.exec(s);
  const us = iso ? null : US.exec(s);
  const [y, m, d] = iso ? iso.slice(1).map(Number) : us ? [+us[3], +us[1], +us[2]] : [];
  if (y === undefined) return { ok: false, error: `Invalid date: "${text}"` };
  const normalized = fromDayNumber(utc(y, m, d) / MS_PER_DAY);
  // Rolled-over dates (e.g. Feb 30) normalize to a different day, so they are rejected.
  const expected = `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
  return normalized === expected
    ? { ok: true, value: normalized }
    : { ok: false, error: `Invalid date: "${text}"` };
}

/** Week n (1 to 13): asOf + (n - 1) * 7 + 1 through asOf + n * 7, inclusive. */
export const weekRange = (asOf: IsoDate, n: number): { start: IsoDate; end: IsoDate } => ({
  start: addDays(asOf, (n - 1) * 7 + 1),
  end: addDays(asOf, n * 7),
});
