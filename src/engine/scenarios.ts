import { validateCurve } from "./curves";
import type { Assumptions, ScenarioId } from "./types";

type Scenarios = Assumptions["scenarios"];
type Customers = Assumptions["customers"];

export const DEFAULT_SCENARIOS: Scenarios = {
  best: { factor: 1.1, extraDelayWeeks: 0 },
  expected: { factor: 1, extraDelayWeeks: 0 },
  worst: { factor: 0.8, extraDelayWeeks: 2 },
};

const SCENARIO_IDS: ScenarioId[] = ["best", "expected", "worst"];
const inRange = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const isInt = (v: unknown, min: number, max: number) => inRange(v, min, max) && Number.isInteger(v);

/** Returns readable error messages; empty means valid. */
export function validateScenarios(s: Scenarios): string[] {
  const errors: string[] = [];
  for (const id of SCENARIO_IDS) {
    if (!inRange(s[id]?.factor, 0.5, 1.5)) errors.push(`${id} factor must be between 0.5 and 1.5.`);
    if (!isInt(s[id]?.extraDelayWeeks, 0, 4))
      errors.push(`${id} extra delay must be a whole number of weeks from 0 to 4.`);
  }
  if (errors.length) return errors;
  if (!(s.best.factor >= s.expected.factor && s.expected.factor >= s.worst.factor)) {
    errors.push("Factors must satisfy best ≥ expected ≥ worst.");
  }
  if (!(
    s.best.extraDelayWeeks <= s.expected.extraDelayWeeks &&
    s.expected.extraDelayWeeks <= s.worst.extraDelayWeeks
  )) {
    errors.push("Extra delay must satisfy best ≤ expected ≤ worst.");
  }
  return errors;
}

export function validateCustomers(customers: Customers): string[] {
  const errors: string[] = [];
  for (const [key, c] of Object.entries(customers)) {
    if (c.delayWeeks !== undefined && !isInt(c.delayWeeks, 0, 8)) {
      errors.push(`${key}: delay must be a whole number of weeks from 0 to 8.`);
    }
    if (c.reliability !== undefined && !inRange(c.reliability, 0, 1)) {
      errors.push(`${key}: reliability must be between 0 and 1.`);
    }
  }
  return errors;
}

export function validateAssumptions(a: Assumptions): string[] {
  if (a.version !== 1) return ["Unsupported assumptions version."];
  const curveErrors = Object.entries(a.curves).flatMap(([bucket, curve]) =>
    validateCurve(curve, `${bucket} curve`),
  );
  return [...curveErrors, ...validateScenarios(a.scenarios), ...validateCustomers(a.customers)];
}
