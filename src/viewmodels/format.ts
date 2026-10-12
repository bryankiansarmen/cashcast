// The only place figures are rounded, and only for display (INV-03). Halves round away from zero.
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
  signDisplay: "negative", // a value that rounds to zero shows no sign
});
const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0,
  signDisplay: "negative",
});

export const ROUNDING_FOOTNOTE =
  "Figures are rounded to whole dollars for display; totals are computed before rounding.";

/** Whole dollars from (possibly fractional) cents, e.g. 1234560 gives "$12,346". */
export const formatCurrency = (cents: number): string => currency.format(cents / 100);

/** Whole percent from a ratio, e.g. 0.256 gives "26%". */
export const formatPercent = (ratio: number): string => percent.format(ratio);
