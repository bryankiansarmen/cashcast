import { applyDerivedDelays, deriveCustomerDelays } from "../engine/customers";
import { DEFAULT_CURVES } from "../engine/curves";
import { forecastAll } from "../engine/forecast-all";
import type { CheckFailure } from "../engine/reconcile";
import { DEFAULT_SCENARIOS } from "../engine/scenarios";
import type { Assumptions, Invoice, IsoDate, PaidInvoice, ScenarioId } from "../engine/types";
import { formatCurrency } from "./format";

export type { ScenarioId };

export const SCENARIO_IDS: readonly ScenarioId[] = ["best", "expected", "worst"];
export const SCENARIO_LABELS: Record<ScenarioId, string> = {
  best: "Best",
  expected: "Expected",
  worst: "Worst",
};

export const ILLUSTRATIVE_LABEL =
  "Illustrative default assumptions, not industry benchmarks. Edit them to match your business.";

/** Kinds of number the forecast view displays; the explain registry must have an entry for each (INV-07). */
export const FORECAST_EXPLAIN_IDS = [
  "forecast.collected13",
  "forecast.uncollected",
  "forecast.next4",
  "forecast.weekInflow",
  "forecast.weekCumulative",
] as const;

export interface ForecastRow {
  week: number;
  start: IsoDate;
  end: IsoDate;
  inflowCents: number; // selected scenario
  cumulativeBestCents: number;
  cumulativeExpectedCents: number;
  cumulativeWorstCents: number;
}

export interface ForecastView {
  asOf: IsoDate;
  scenario: ScenarioId;
  /** Failed reconciliation checks. When non-empty nothing may be displayed (INV-04). */
  blocked: CheckFailure[];
  /** True while curves and scenario parameters are the built-in illustrative defaults (INV-13). */
  usingDefaults: boolean;
  rows: ForecastRow[];
  metrics: {
    collectedCents: number; // expected scenario, weeks 1 to 13
    uncollectedCents: number; // expected scenario, not collected within the horizon
    next4Cents: number; // expected scenario, weeks 1 to 4
    totalOpenCents: number;
  };
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Display structure for the forecast. History-derived delays are merged in; manual overrides win. */
export function buildForecastView(
  invoices: readonly Invoice[],
  history: readonly PaidInvoice[],
  assumptions: Assumptions,
  asOf: IsoDate,
  scenario: ScenarioId,
): ForecastView {
  const effective = applyDerivedDelays(assumptions, deriveCustomerDelays(history));
  const { results, failures } = forecastAll(invoices, effective, asOf);
  const selected = results[scenario].weeks;
  const expected = results.expected;
  return {
    asOf,
    scenario,
    blocked: failures,
    usingDefaults:
      sameJson(assumptions.curves, DEFAULT_CURVES) &&
      sameJson(assumptions.scenarios, DEFAULT_SCENARIOS),
    rows: selected.map((w, i) => ({
      week: w.week,
      start: w.start,
      end: w.end,
      inflowCents: w.inflowCents,
      cumulativeBestCents: results.best.weeks[i].cumulativeCents,
      cumulativeExpectedCents: expected.weeks[i].cumulativeCents,
      cumulativeWorstCents: results.worst.weeks[i].cumulativeCents,
    })),
    metrics: {
      collectedCents: expected.weeks[12].cumulativeCents,
      uncollectedCents: expected.uncollectedCents,
      next4Cents: expected.weeks[3].cumulativeCents,
      totalOpenCents: expected.totalOpenCents,
    },
  };
}

/** Points for the chart. The table reads the same rows through `tableRows`; a test keeps them equal. */
export const chartData = (view: ForecastView) =>
  view.rows.map((r) => ({
    week: `W${r.week}`,
    inflow: r.inflowCents,
    best: r.cumulativeBestCents,
    expected: r.cumulativeExpectedCents,
    worst: r.cumulativeWorstCents,
  }));

export const tableRows = (view: ForecastView) =>
  view.rows.map((r) => ({
    week: `W${r.week}`,
    start: r.start,
    end: r.end,
    inflow: r.inflowCents,
    best: r.cumulativeBestCents,
    expected: r.cumulativeExpectedCents,
    worst: r.cumulativeWorstCents,
  }));

/** Text alternative for the chart. */
export const chartSummary = (view: ForecastView): string => {
  const last = view.rows[view.rows.length - 1];
  return (
    `Cumulative collections over 13 weeks from ${view.asOf}: ` +
    `expected ${formatCurrency(last.cumulativeExpectedCents)}, ` +
    `best ${formatCurrency(last.cumulativeBestCents)}, ` +
    `worst ${formatCurrency(last.cumulativeWorstCents)}. Weekly bars show the ${SCENARIO_LABELS[view.scenario].toLowerCase()} scenario.`
  );
};
