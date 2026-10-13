import { describe, expect, it } from "vitest";
import {
  generateTransactionSample,
  SAMPLE_BUDGET,
  SAMPLE_RULES,
} from "../../src/sample/budget-sample";
import {
  BUDGET_EXPLAIN_IDS,
  buildBudgetView,
  monthLabel,
  STATUS_DISPLAY,
} from "../../src/viewmodels/budget-view";
import { EXPLAIN, EXPLAIN_IDS, explainView } from "../../src/viewmodels/explain";
import { dollarsInputText } from "../../src/viewmodels/format";
import { monthsOf } from "../../src/budget/variance";
import type { Assumptions } from "../../src/engine/types";
import { DEFAULT_CURVES } from "../../src/engine/curves";
import { DEFAULT_SCENARIOS } from "../../src/engine/scenarios";

const txs = generateTransactionSample();
const view = (month = "2026-09", budget = SAMPLE_BUDGET) =>
  buildBudgetView(txs, SAMPLE_RULES, budget, month);

describe("buildBudgetView", () => {
  it("lists the months of data with readable labels and the selected month", () => {
    const v = view();
    expect(v.months).toEqual([
      { value: "2026-07", label: "July 2026" },
      { value: "2026-08", label: "August 2026" },
      { value: "2026-09", label: "September 2026" },
    ]);
    expect(v).toMatchObject({ month: "2026-09", monthLabel: "September 2026", isEmpty: false });
  });

  it("rows carry spend, budget, variance, status text, and an icon for September", () => {
    const rows = Object.fromEntries(view().rows.map((r) => [r.category, r]));
    expect(rows.Travel).toMatchObject({
      spendCents: 80_862,
      budgetCents: 60_000,
      varianceCents: 20_862,
      status: "over",
      statusLabel: "Over budget",
      statusIcon: "▲",
      hasTarget: true,
      targetText: "600",
    });
    expect(rows.Meals).toMatchObject({
      status: "near",
      statusLabel: "Near budget",
      statusIcon: "!",
    });
    expect(rows["Office supplies"]).toMatchObject({
      status: "on_track",
      statusLabel: "On track",
      statusIcon: "✓",
    });
    expect(rows["Staff welfare"]).toMatchObject({
      status: "unbudgeted",
      statusLabel: "Unbudgeted",
      statusIcon: "?",
      hasTarget: false,
      targetText: "",
      variancePct: null,
    });
  });

  it("every status has distinct text and a distinct icon, so colour is never the only signal", () => {
    const all = Object.values(STATUS_DISPLAY);
    expect(new Set(all.map((s) => s.label)).size).toBe(4);
    expect(new Set(all.map((s) => s.icon)).size).toBe(4);
    expect(all.every((s) => s.label.length > 0 && s.icon.length > 0)).toBe(true);
  });

  it("totals add up from the rows and match the recorded September figures", () => {
    const { totals, rows } = view();
    expect(totals.spendCents).toBe(rows.reduce((s, r) => s + r.spendCents, 0));
    expect(totals.budgetCents).toBe(
      Object.values(SAMPLE_BUDGET.monthlyCents).reduce((a, b) => a + b, 0),
    );
    expect(totals.varianceCents).toBe(totals.spendCents - totals.budgetCents);
    expect(totals.categoriesOver).toBe(2);
    expect(totals.unbudgetedSpendCents).toBe(12_186 + 4964);
  });

  it("top contributors are the three largest outflows with their details", () => {
    const travel = view().rows.find((r) => r.category === "Travel")!;
    expect(travel.topContributors).toHaveLength(3);
    expect(travel.topContributors[0]).toEqual({
      id: expect.any(String),
      date: expect.stringMatching(/^2026-09-/),
      description: expect.any(String),
      amountCents: expect.any(Number),
    });
    const sizes = travel.topContributors.map((t) => Math.abs(t.amountCents));
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });

  it("targets show as dollars, and an edited budget changes status and totals", () => {
    const raised = { monthlyCents: { ...SAMPLE_BUDGET.monthlyCents, Travel: 100_000 } };
    const v = view("2026-09", raised);
    expect(v.rows.find((r) => r.category === "Travel")).toMatchObject({
      targetText: "1000",
      status: "on_track",
    });
    expect(v.totals.categoriesOver).toBe(1);
    expect(v.totals.budgetCents).toBe(view().totals.budgetCents + 40_000);
  });

  it("is empty with no transactions and still shows Uncategorized", () => {
    const v = buildBudgetView([], SAMPLE_RULES, SAMPLE_BUDGET, "");
    expect(v.isEmpty).toBe(true);
    expect(v.months).toEqual([]);
    expect(v.rows.some((r) => r.category === "Uncategorized")).toBe(true);
  });

  it("is pure", () => {
    expect(view()).toEqual(view());
  });
});

describe("helpers", () => {
  it.each([
    ["2026-01", "January 2026"],
    ["2026-12", "December 2026"],
    ["2026-09", "September 2026"],
    ["2026-13", "2026-13 2026"], // an unknown month falls back to its key
  ])("monthLabel %s is %s", (key, label) => expect(monthLabel(key)).toBe(label));

  it.each([
    [240_000, "2400"],
    [25_055, "250.55"],
    [5, "0.05"],
    [10, "0.10"],
    [0, "0"],
    [100, "1"],
  ])("dollarsInputText(%d) is %s", (cents, text) => expect(dollarsInputText(cents)).toBe(text));

  it("monthsOf returns distinct months oldest first", () => {
    expect(monthsOf(txs)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(monthsOf([])).toEqual([]);
  });
});

describe("explain entries for the budget page (INV-07)", () => {
  const ctx = {
    assumptions: {
      version: 1,
      curves: DEFAULT_CURVES,
      scenarios: DEFAULT_SCENARIOS,
      customers: {},
    } as Assumptions,
    asOf: "2026-09-30",
    scenario: "expected" as const,
    usingDefaults: true,
    month: "2026-09",
    ruleCount: 14,
  };

  it("registers every budget ID, each with a complete entry", () => {
    expect(BUDGET_EXPLAIN_IDS).toHaveLength(10);
    for (const id of BUDGET_EXPLAIN_IDS) {
      expect(EXPLAIN_IDS).toContain(id);
      expect(EXPLAIN[id].formula.length).toBeGreaterThan(40);
      expect(EXPLAIN[id].inputs.length).toBeGreaterThan(0);
      expect(EXPLAIN[id].assumptions.length).toBeGreaterThan(0);
    }
  });

  it("uses the spec's wording for status, categorization, and top contributors", () => {
    expect(EXPLAIN["budget.categoryStatus"].formula).toContain(
      "unbudgeted if budget is 0 and spend is above 0; over if spend exceeds budget; near if spend is at least 90% of budget; otherwise on_track",
    );
    expect(EXPLAIN["budget.categorySpend"].formula).toContain(
      "CSV category if not blank, else the first matching rule in list order (case-insensitive substring of the description), else Uncategorized",
    );
    expect(EXPLAIN["budget.contributors"].formula).toContain(
      "ties broken by earlier date, then input order",
    );
    expect(EXPLAIN["budget.categoryVariance"].formula).toContain(
      "variance = spendCents − budgetCents; positive means over budget",
    );
  });

  it("shows the month and the number of rules in use", () => {
    const v = Object.fromEntries(
      explainView("budget.totalSpend", ctx).values.map((x) => [x.label, x.value]),
    );
    expect(v).toEqual({ Month: "September 2026", "Categorization rules": "14" });
  });
});
