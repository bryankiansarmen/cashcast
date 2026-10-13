import { describe, expect, it } from "vitest";
import { DEFAULT_CURVES } from "../../src/engine/curves";
import { DEFAULT_SCENARIOS } from "../../src/engine/scenarios";
import type { Assumptions } from "../../src/engine/types";
import { AGING_EXPLAIN_IDS } from "../../src/viewmodels/aging-view";
import { EXPLAIN, EXPLAIN_IDS, explainView, type ExplainId } from "../../src/viewmodels/explain";
import { FORECAST_EXPLAIN_IDS } from "../../src/viewmodels/forecast-view";
import { RECONCILIATION_EXPLAIN_IDS } from "../../src/viewmodels/reconciliation-view";

const defaults: Assumptions = {
  version: 1,
  curves: DEFAULT_CURVES,
  scenarios: DEFAULT_SCENARIOS,
  customers: {},
};
const ctx = {
  assumptions: defaults,
  asOf: "2026-09-30",
  scenario: "worst" as const,
  usingDefaults: true,
};

describe("explain registry (INV-07)", () => {
  it("covers every kind of number the aging and forecast views display, plus reconciliation and curve totals", () => {
    for (const id of [
      ...AGING_EXPLAIN_IDS,
      ...FORECAST_EXPLAIN_IDS,
      ...RECONCILIATION_EXPLAIN_IDS,
      "assumptions.curveTotal",
    ]) {
      expect(EXPLAIN_IDS).toContain(id);
    }
    expect(EXPLAIN_IDS).toHaveLength(14);
    expect(new Set(EXPLAIN_IDS).size).toBe(EXPLAIN_IDS.length);
    expect(Object.keys(EXPLAIN).sort()).toEqual([...EXPLAIN_IDS].sort());
  });

  it.each([...EXPLAIN_IDS])("%s has a title, formula text, inputs, and assumptions used", (id) => {
    const e = EXPLAIN[id];
    expect(e.title.length).toBeGreaterThan(3);
    expect(e.formula.length).toBeGreaterThan(40);
    expect(e.inputs.length).toBeGreaterThan(0);
    expect(e.assumptions.length).toBeGreaterThan(0);
    expect([...e.inputs, ...e.assumptions].every((t) => t.trim().length > 0)).toBe(true);
  });

  // Wording taken from the calculation spec; if a formula changes there, update both.
  it.each(FORECAST_EXPLAIN_IDS.filter((id) => id !== "forecast.uncollected"))(
    "%s quotes the weekly calculation",
    (id) => {
      const f = EXPLAIN[id].formula;
      for (const phrase of [
        "delay = delayWeeks + extraDelayWeeks",
        "scale = min(reliability × factor, 1 / curveSum)",
        "startWeek + k + delay",
        "openCents × curve[k] × scale",
        "counted only if the week is 13 or less",
      ]) {
        expect(f).toContain(phrase);
      }
    },
  );

  it("week definitions use the spec's wording", () => {
    for (const id of ["forecast.next4", "forecast.weekInflow"] as const) {
      expect(EXPLAIN[id].formula).toContain(
        "days asOf + (n − 1) × 7 + 1 through asOf + n × 7, inclusive",
      );
    }
  });

  it("states how uncollected, past due, and buckets are defined", () => {
    expect(EXPLAIN["forecast.uncollected"].formula).toContain(
      "uncollected = openCents − sum of the invoice's inflows",
    );
    expect(EXPLAIN["forecast.uncollected"].formula).toContain(
      "1 − curveSum is the share not collected within the horizon",
    );
    expect(EXPLAIN["aging.pastDue"].formula).toContain(
      "daysPastDue is asOf minus dueDate in whole days",
    );
    expect(EXPLAIN["aging.bucketTotal"].formula).toContain("91+ is 91 or more");
    expect(EXPLAIN["aging.totalOpen"].formula).toContain("never netted");
    expect(EXPLAIN["assumptions.curveTotal"].formula).toContain("exactly 13 values");
  });

  it("figures that need no assumptions say so", () => {
    for (const id of AGING_EXPLAIN_IDS)
      expect(EXPLAIN[id].assumptions).toEqual(["None. This figure uses no assumptions."]);
  });
});

describe("explainView values", () => {
  const values = (id: ExplainId, c = ctx) =>
    Object.fromEntries(explainView(id, c).values.map((v) => [v.label, v.value]));

  it("always shows the as-of date, except for curve totals which show the totals themselves", () => {
    for (const id of EXPLAIN_IDS.filter((i) => i !== "assumptions.curveTotal"))
      expect(values(id)["As-of date"]).toBe("2026-09-30");
    expect(values("assumptions.curveTotal")["As-of date"]).toBeUndefined();
    expect(values("assumptions.curveTotal")["Curve totals"]).toBe(
      "Current 91.0%, 1–30 81.0%, 31–60 65.0%, 61–90 46.0%, 91+ 23.0%",
    );
  });

  it("collections figures use the expected scenario whatever is selected", () => {
    for (const id of ["forecast.collected13", "forecast.uncollected", "forecast.next4"] as const) {
      expect(values(id).Scenario).toBe("Expected: factor 1, extra delay 0 weeks");
    }
  });

  it("weekly collections use the selected scenario; cumulative lists all three", () => {
    expect(values("forecast.weekInflow").Scenario).toBe("Worst: factor 0.8, extra delay 2 weeks");
    expect(values("forecast.weekCumulative").Scenarios).toBe(
      "Best: factor 1.1, extra delay 0 weeks; Expected: factor 1, extra delay 0 weeks; Worst: factor 0.8, extra delay 2 weeks",
    );
  });

  it("reports the assumption source and customer adjustments in use", () => {
    expect(values("forecast.collected13")["Assumption source"]).toBe(
      "Illustrative defaults, not industry benchmarks",
    );
    const edited: Assumptions = {
      ...defaults,
      scenarios: { ...DEFAULT_SCENARIOS, worst: { factor: 0.7, extraDelayWeeks: 1 } },
      customers: {
        a: { delayWeeks: 2 },
        b: { delayWeeks: 0, reliability: 0.5 },
        c: { reliability: 0.9 },
      },
    };
    const v = values("forecast.weekInflow", { ...ctx, assumptions: edited, usingDefaults: false });
    expect(v["Assumption source"]).toBe("Edited by you");
    expect(v["Customer delay overrides"]).toBe("2");
    expect(v["Customer reliability settings"]).toBe("2");
    expect(v.Scenario).toBe("Worst: factor 0.7, extra delay 1 week");
  });

  it("keeps the registry entry text intact", () => {
    const view = explainView("aging.totalOpen", ctx);
    expect(view.title).toBe(EXPLAIN["aging.totalOpen"].title);
    expect(view.formula).toBe(EXPLAIN["aging.totalOpen"].formula);
  });
});
