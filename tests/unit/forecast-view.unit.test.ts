import { describe, expect, it } from "vitest";
import { DEFAULT_CURVES } from "../../src/engine/curves";
import { DEFAULT_SCENARIOS } from "../../src/engine/scenarios";
import type { Assumptions } from "../../src/engine/types";
import { generateArSample } from "../../src/sample/ar-sample";
import { SAMPLE_AS_OF } from "../../src/sample/constants";
import { generateHistorySample } from "../../src/sample/history-sample";
import {
  chartData,
  chartSummary,
  buildForecastView,
  FORECAST_EXPLAIN_IDS,
  ILLUSTRATIVE_LABEL,
  SCENARIO_IDS,
  tableRows,
} from "../../src/viewmodels/forecast-view";

const invoices = generateArSample();
const defaults: Assumptions = {
  version: 1,
  curves: DEFAULT_CURVES,
  scenarios: DEFAULT_SCENARIOS,
  customers: {},
};
const build = (
  opts: {
    history?: ReturnType<typeof generateHistorySample>;
    assumptions?: Assumptions;
    scenario?: "best" | "expected" | "worst";
  } = {},
) =>
  buildForecastView(
    invoices,
    opts.history ?? [],
    opts.assumptions ?? defaults,
    SAMPLE_AS_OF,
    opts.scenario ?? "expected",
  );
const view = build();

describe("buildForecastView", () => {
  it("reconciles for the sample data and has 13 rows with dates", () => {
    expect(view.blocked).toEqual([]);
    expect(view.rows).toHaveLength(13);
    expect(view.rows[0]).toMatchObject({ week: 1, start: "2026-10-01", end: "2026-10-07" });
    expect(view.rows[12]).toMatchObject({ week: 13, start: "2026-12-24", end: "2026-12-30" });
  });

  it("chart and table read the same figures from one viewmodel", () => {
    const chart = chartData(view);
    const table = tableRows(view);
    expect(chart).toHaveLength(table.length);
    chart.forEach((c, i) => {
      const t = table[i];
      expect([c.week, c.inflow, c.best, c.expected, c.worst]).toEqual([
        t.week,
        t.inflow,
        t.best,
        t.expected,
        t.worst,
      ]);
    });
  });

  it("metrics are the expected scenario: collected + uncollected = total open, next 4 weeks is a prefix", () => {
    const m = view.metrics;
    expect(m.collectedCents + m.uncollectedCents).toBeCloseTo(m.totalOpenCents, 3);
    expect(m.totalOpenCents).toBe(153_453_445);
    expect(m.next4Cents).toBeGreaterThan(0);
    expect(m.next4Cents).toBeLessThan(m.collectedCents);
    expect(m.collectedCents).toBeCloseTo(view.rows[12].cumulativeExpectedCents, 6);
    expect(m.next4Cents).toBeCloseTo(view.rows[3].cumulativeExpectedCents, 6);
  });

  it("metrics do not change with the selected scenario, but the weekly column does", () => {
    const worst = build({ scenario: "worst" });
    expect(worst.metrics).toEqual(view.metrics);
    expect(worst.rows[0].inflowCents).not.toBe(view.rows[0].inflowCents);
    for (const s of SCENARIO_IDS)
      expect(build({ scenario: s }).rows[0].cumulativeExpectedCents).toBe(
        view.rows[0].cumulativeExpectedCents,
      );
  });

  it("selected weekly inflows add up to that scenario's cumulative line", () => {
    for (const s of SCENARIO_IDS) {
      const v = build({ scenario: s });
      const sum = v.rows.reduce((t, r) => t + r.inflowCents, 0);
      const last = v.rows[12];
      expect(sum).toBeCloseTo(
        {
          best: last.cumulativeBestCents,
          expected: last.cumulativeExpectedCents,
          worst: last.cumulativeWorstCents,
        }[s],
        3,
      );
    }
  });

  it("keeps cumulative worst <= expected <= best in every week", () => {
    for (const r of view.rows) {
      expect(r.cumulativeWorstCents).toBeLessThanOrEqual(r.cumulativeExpectedCents);
      expect(r.cumulativeExpectedCents).toBeLessThanOrEqual(r.cumulativeBestCents);
    }
  });

  it("applies history-derived delays, which push collections later", () => {
    const withHistory = build({ history: generateHistorySample() });
    expect(withHistory.blocked).toEqual([]);
    expect(withHistory.metrics.collectedCents).toBeLessThan(view.metrics.collectedCents);
    expect(withHistory.metrics.totalOpenCents).toBe(view.metrics.totalOpenCents);
  });

  it("a manual delay override beats the derived one", () => {
    const history = generateHistorySample();
    const manual: Assumptions = {
      ...defaults,
      customers: {
        "granite peak builders": { delayWeeks: 0 },
        "alder & pine llc": { delayWeeks: 0 },
        "driftwood analytics": { delayWeeks: 0 },
        "kestrel freight": { delayWeeks: 0 },
      },
    };
    expect(build({ history, assumptions: manual }).metrics.collectedCents).toBeCloseTo(
      view.metrics.collectedCents,
      6,
    );
  });

  it("blocks display and names the failed checks when reconciliation fails (INV-04)", () => {
    const bad: Assumptions = {
      ...defaults,
      curves: { ...DEFAULT_CURVES, d1_30: [-0.2, 0.5, ...new Array(11).fill(0)] },
    };
    const blocked = build({ assumptions: bad });
    expect(blocked.blocked.map((f) => f.id)).toContain("R3");
    expect(blocked.blocked[0].message.length).toBeGreaterThan(0);
  });

  it("flags default assumptions as illustrative until a curve or scenario changes (INV-13)", () => {
    expect(view.usingDefaults).toBe(true);
    expect(ILLUSTRATIVE_LABEL).toMatch(/Illustrative/);
    const editedCurve = {
      ...defaults,
      curves: {
        ...DEFAULT_CURVES,
        current: [0.5, ...DEFAULT_CURVES.current.slice(1, 5), ...new Array(8).fill(0)],
      },
    };
    expect(build({ assumptions: editedCurve }).usingDefaults).toBe(false);
    const editedScenario = {
      ...defaults,
      scenarios: { ...DEFAULT_SCENARIOS, worst: { factor: 0.7, extraDelayWeeks: 2 } },
    };
    expect(build({ assumptions: editedScenario }).usingDefaults).toBe(false);
    expect(
      build({ assumptions: { ...defaults, customers: { acme: { delayWeeks: 1 } } } }).usingDefaults,
    ).toBe(true);
  });

  it("describes the chart in text and handles an empty portfolio", () => {
    expect(chartSummary(view)).toMatch(
      /^Cumulative collections over 13 weeks from 2026-09-30: expected \$[\d,]+, best \$[\d,]+, worst \$[\d,]+\./,
    );
    const empty = buildForecastView([], [], defaults, SAMPLE_AS_OF, "expected");
    expect(empty.blocked).toEqual([]);
    expect(empty.metrics).toEqual({
      collectedCents: 0,
      uncollectedCents: 0,
      next4Cents: 0,
      totalOpenCents: 0,
    });
  });

  it("names every kind of number it displays so the explain registry can cover them (INV-07)", () => {
    expect(new Set(FORECAST_EXPLAIN_IDS).size).toBe(FORECAST_EXPLAIN_IDS.length);
    expect(FORECAST_EXPLAIN_IDS.every((id) => id.startsWith("forecast."))).toBe(true);
  });
});
