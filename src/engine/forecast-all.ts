import { agingSummary } from "./aging";
import { forecast } from "./forecast";
import { reconcile, type CheckFailure } from "./reconcile";
import type { Assumptions, ForecastResult, Invoice, IsoDate, ScenarioId } from "./types";

/** Runs all three scenarios and reconciles them; a non-empty `failures` blocks display. */
export function forecastAll(
  invoices: readonly Invoice[],
  assumptions: Assumptions,
  asOf: IsoDate,
): { results: Record<ScenarioId, ForecastResult>; failures: CheckFailure[] } {
  const results = {
    best: forecast(invoices, assumptions, "best", asOf),
    expected: forecast(invoices, assumptions, "expected", asOf),
    worst: forecast(invoices, assumptions, "worst", asOf),
  };
  const aging = agingSummary(invoices, asOf);
  return { results, failures: reconcile({ invoices, assumptions, asOf, aging, results }) };
}
