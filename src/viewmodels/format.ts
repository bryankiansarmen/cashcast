// The only place figures are rounded, and only for display (INV-03). Halves round away from zero.
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
  signDisplay: "negative", // a value that rounds to zero shows no sign
});

export const ROUNDING_FOOTNOTE =
  "Dollars are rounded to whole dollars and percentages to one decimal for display; totals are computed before rounding.";

/** Whole dollars from (possibly fractional) cents, e.g. 1234560 gives "$12,346". */
export const formatCurrency = (cents: number): string => currency.format(cents / 100);

/** Percent from a ratio with a fixed number of decimals (default none), e.g. 0.256 gives "26%". */
export const formatPercent = (ratio: number, decimals = 0): string =>
  new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: "negative",
  }).format(ratio);
