import type { BucketId, Curve } from "./types";

export const CURVE_LENGTH = 13;

// Illustrative values, not industry benchmarks; label them as such wherever shown.
export const DEFAULT_CURVES: Record<BucketId, Curve> = {
  current: [0.4, 0.2, 0.12, 0.08, 0.05, 0.03, 0.02, 0.01, 0, 0, 0, 0, 0],
  d1_30: [0.3, 0.2, 0.12, 0.08, 0.05, 0.03, 0.02, 0.01, 0, 0, 0, 0, 0],
  d31_60: [0.18, 0.14, 0.1, 0.07, 0.05, 0.04, 0.03, 0.02, 0.01, 0.01, 0, 0, 0],
  d61_90: [0.1, 0.08, 0.07, 0.05, 0.04, 0.03, 0.03, 0.02, 0.02, 0.01, 0.01, 0, 0],
  d91_plus: [0.04, 0.03, 0.03, 0.02, 0.02, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01],
};

const SUM_TOLERANCE = 1e-9; // float noise only: ten 0.1s sum to 0.9999999999999999

/** Returns readable error messages; empty means valid. */
export function validateCurve(curve: Curve, label = "Curve"): string[] {
  if (!Array.isArray(curve) || curve.length !== CURVE_LENGTH) {
    return [`${label} must have exactly ${CURVE_LENGTH} values.`];
  }
  const errors: string[] = [];
  curve.forEach((v, i) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) {
      errors.push(`${label} week ${i + 1} must be a number between 0 and 1.`);
    }
  });
  if (errors.length) return errors;
  const sum = curve.reduce((a, b) => a + b, 0);
  if (sum > 1 + SUM_TOLERANCE)
    errors.push(`${label} values add up to ${sum.toFixed(2)}; the total must be at most 1.`);
  return errors;
}
