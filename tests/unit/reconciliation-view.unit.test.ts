import { describe, expect, it } from "vitest";
import { agingSummary } from "../../src/engine/aging";
import { DEFAULT_CURVES } from "../../src/engine/curves";
import { forecastAll } from "../../src/engine/forecast-all";
import type { CheckId, ReconcileInput } from "../../src/engine/reconcile";
import { DEFAULT_SCENARIOS } from "../../src/engine/scenarios";
import type { Assumptions } from "../../src/engine/types";
import { generateArSample } from "../../src/sample/ar-sample";
import { SAMPLE_AS_OF } from "../../src/sample/constants";
import { EXPLAIN, EXPLAIN_IDS } from "../../src/viewmodels/explain";
import { buildForecastView } from "../../src/viewmodels/forecast-view";
import {
  buildReconciliationView,
  describeReconciliation,
  RECONCILIATION_EXPLAIN_IDS,
} from "../../src/viewmodels/reconciliation-view";

const invoices = generateArSample();
const assumptions: Assumptions = {
  version: 1,
  curves: DEFAULT_CURVES,
  scenarios: DEFAULT_SCENARIOS,
  customers: {},
};
// A fresh copy per test so corruptions never leak between cases.
const input = (): ReconcileInput => ({
  invoices,
  assumptions,
  asOf: SAMPLE_AS_OF,
  aging: agingSummary(invoices, SAMPLE_AS_OF),
  results: structuredClone(forecastAll(invoices, assumptions, SAMPLE_AS_OF).results),
});

describe("buildReconciliationView", () => {
  it("is reconciled for the sample data, with the Reconciled label", () => {
    const v = buildReconciliationView(input());
    expect(v).toMatchObject({ status: "reconciled", label: "Reconciled", failures: [] });
    expect(v.summary).toBe("All reconciliation checks passed.");
  });

  const corruptions: [CheckId, (i: ReconcileInput) => void][] = [
    ["R1", (i) => void (i.results.expected.uncollectedCents += 100)],
    ["R2", (i) => void (i.aging.buckets.current.totalCents += 1)],
    [
      "R3",
      (i) =>
        void (i.assumptions = {
          ...assumptions,
          curves: { ...DEFAULT_CURVES, d1_30: [-0.2, 0.5, ...new Array(11).fill(0)] },
        }),
    ],
    ["R4", (i) => void (i.results.worst.weeks[5].cumulativeCents += 1e9)],
    ["R5", (i) => void (i.results.expected.weeks[2].inflowCents = -5)],
  ];
  it.each(corruptions)("a corrupted result blocks the forecast and names %s", (id, corrupt) => {
    const i = input();
    corrupt(i);
    const v = buildReconciliationView(i);
    expect(v.status).toBe("blocked");
    expect(v.label).toBe("Not reconciled");
    expect(v.failures.map((f) => f.id)).toContain(id);
    expect(v.summary).toContain(id);
    expect(v.summary).toMatch(/^The forecast failed reconciliation \(.*\), so it is hidden\.$/);
    expect(v.failures.every((f) => f.message.length > 0)).toBe(true);
  });

  it("lists each failed check ID once, in order, however many scenarios failed it", () => {
    const i = input();
    i.results.best.uncollectedCents += 100;
    i.results.expected.uncollectedCents += 100;
    i.aging.buckets.current.totalCents += 1;
    const v = buildReconciliationView(i);
    expect(v.failures.filter((f) => f.id === "R1").length).toBeGreaterThan(1);
    expect(v.summary).toBe("The forecast failed reconciliation (R1, R2), so it is hidden.");
  });
});

describe("describeReconciliation", () => {
  it("reports reconciled for no failures and blocks on any failure", () => {
    expect(describeReconciliation([]).status).toBe("reconciled");
    expect(describeReconciliation([{ id: "R4", message: "x" }]).status).toBe("blocked");
  });

  it("does not mutate the failures it is given", () => {
    const failures = [{ id: "R3" as const, message: "bad" }];
    describeReconciliation(failures).failures.push({ id: "R1", message: "extra" });
    expect(failures).toHaveLength(1);
  });
});

describe("forecast view integration", () => {
  it("carries a reconciled status for valid assumptions", () => {
    expect(
      buildForecastView(invoices, [], assumptions, SAMPLE_AS_OF, "expected").reconciliation.status,
    ).toBe("reconciled");
  });

  it("is blocked, naming the check, for assumptions that break a check", () => {
    const bad = {
      ...assumptions,
      curves: { ...DEFAULT_CURVES, d1_30: [-0.2, 0.5, ...new Array(11).fill(0)] },
    };
    const view = buildForecastView(invoices, [], bad, SAMPLE_AS_OF, "expected");
    expect(view.reconciliation.status).toBe("blocked");
    expect(view.reconciliation.summary).toContain("R3");
  });
});

describe("explain entry for the indicator (INV-07)", () => {
  it("is registered and describes all five checks and the blocked outcome", () => {
    for (const id of RECONCILIATION_EXPLAIN_IDS) expect(EXPLAIN_IDS).toContain(id);
    const f = EXPLAIN["reconciliation.status"].formula;
    for (const check of ["R1:", "R2:", "R3:", "R4:", "R5:"]) expect(f).toContain(check);
    expect(f).toContain(
      "cumulative worst is at most expected, which is at most best, in every week",
    );
    expect(f).toContain("the forecast is hidden");
  });
});
