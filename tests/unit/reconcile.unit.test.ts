import { describe, expect, it } from "vitest";
import { agingSummary } from "../../src/engine/aging";
import { DEFAULT_CURVES } from "../../src/engine/curves";
import { forecastAll } from "../../src/engine/forecast-all";
import { reconcile, type CheckId, type ReconcileInput } from "../../src/engine/reconcile";
import { DEFAULT_SCENARIOS } from "../../src/engine/scenarios";
import type { Assumptions, Invoice } from "../../src/engine/types";

const asOf = "2026-09-30";
const assumptions: Assumptions = {
  version: 1,
  curves: DEFAULT_CURVES,
  scenarios: DEFAULT_SCENARIOS,
  customers: { beta: { delayWeeks: 1 } },
};
const invoices: Invoice[] = [
  {
    id: "A",
    invoiceNumber: "",
    customerKey: "acme",
    customerName: "Acme",
    dueDate: "2026-09-20",
    openCents: 1_000_000,
  },
  {
    id: "B",
    invoiceNumber: "",
    customerKey: "beta",
    customerName: "Beta",
    dueDate: "2026-10-14",
    openCents: 2_000_000,
  },
];

// Fresh, mutable copy per test so corruptions never leak between cases.
const input = (): ReconcileInput => ({
  invoices,
  assumptions,
  asOf,
  aging: agingSummary(invoices, asOf),
  results: structuredClone(forecastAll(invoices, assumptions, asOf).results),
});
const ids = (i: ReconcileInput): CheckId[] => reconcile(i).map((f) => f.id);

describe("reconcile", () => {
  it("passes the worked example and forecastAll reports no failures", () => {
    expect(reconcile(input())).toEqual([]);
    expect(forecastAll(invoices, assumptions, asOf).failures).toEqual([]);
  });

  it("passes for an empty portfolio", () => {
    const i = { ...input(), invoices: [], aging: agingSummary([], asOf) };
    i.results = forecastAll([], assumptions, asOf).results;
    expect(reconcile(i)).toEqual([]);
  });

  it("R1: reports inflows plus uncollected that do not equal total open AR", () => {
    const i = input();
    i.results.expected.uncollectedCents += 100;
    expect(ids(i)).toContain("R1");
  });

  it("R2: reports bucket totals that do not sum to total open AR", () => {
    const i = input();
    i.aging.buckets.current.totalCents += 1;
    expect(ids(i)).toContain("R2");
  });

  it("R3: reports probabilities outside 0 to 1", () => {
    const i = input();
    i.assumptions = {
      ...assumptions,
      curves: { ...DEFAULT_CURVES, d1_30: [-0.1, 0.5, ...new Array(11).fill(0)] },
    };
    expect(ids(i)).toContain("R3");
  });

  it("R4: reports broken scenario ordering", () => {
    const i = input();
    i.results.worst.weeks[5].cumulativeCents += 1e6;
    expect(ids(i)).toContain("R4");
  });

  it("R5: reports a negative weekly inflow", () => {
    const i = input();
    i.results.expected.weeks[2].inflowCents = -5;
    expect(ids(i)).toContain("R5");
  });

  it("R5: reports a falling cumulative", () => {
    const i = input();
    i.results.best.weeks[8].cumulativeCents -= 1e7;
    expect(ids(i)).toContain("R5");
  });

  it("failures carry a readable message", () => {
    const i = input();
    i.aging.buckets.current.totalCents += 1;
    expect(reconcile(i)[0].message).toMatch(/Bucket totals/);
  });
});
