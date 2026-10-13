import { describe, expect, it } from "vitest";
import { categorize } from "../../src/budget/categorize";
import { monthKey, varianceReport } from "../../src/budget/variance";
import { UNCATEGORIZED } from "../../src/budget/types";
import { importTransactions } from "../../src/importers/transactions";
import {
  generateTransactionSample,
  SAMPLE_BUDGET,
  SAMPLE_RULES,
} from "../../src/sample/budget-sample";
import { SAMPLE_MONTHS } from "../../src/sample/constants";
import fixture from "../fixtures/transactions-sample.csv?raw";

const sample = generateTransactionSample();

describe("generateTransactionSample", () => {
  it("returns deeply equal output on repeated calls", () => {
    expect(generateTransactionSample()).toEqual(sample);
  });

  it("matches the recorded literal count and total", () => {
    expect(sample).toHaveLength(61);
    expect(sample.reduce((s, t) => s + t.amountCents, 0)).toBe(-1_404_610); // changing the generator means re-recording this
  });

  it("spans exactly July to September 2026, in date order, with recorded counts per month", () => {
    expect(SAMPLE_MONTHS).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect([...new Set(sample.map((t) => monthKey(t.date)))]).toEqual([...SAMPLE_MONTHS]);
    expect(SAMPLE_MONTHS.map((m) => sample.filter((t) => monthKey(t.date) === m).length)).toEqual([
      20, 18, 23,
    ]);
    expect(sample.map((t) => t.date)).toEqual([...sample.map((t) => t.date)].sort());
  });

  it("uses integer cents, unique file-line ids, and has outflows plus one refund", () => {
    expect(sample.every((t) => Number.isInteger(t.amountCents) && t.amountCents !== 0)).toBe(true);
    expect(sample.map((t) => t.id)).toEqual(sample.map((_, i) => `txn-${i + 2}`));
    expect(sample.filter((t) => t.amountCents > 0).map((t) => t.description)).toEqual([
      "Paperbird refund",
    ]);
  });

  it("categorizes through the CSV category first, the rules next, and leaves some Uncategorized", () => {
    const categories = new Map(sample.map((t) => [t.id, categorize(t, SAMPLE_RULES)]));
    expect(new Set(categories.values())).toEqual(
      new Set([
        "Rent",
        "Software",
        "Utilities",
        "Insurance",
        "Travel",
        "Meals",
        "Office supplies",
        "Marketing",
        "Staff welfare",
        UNCATEGORIZED,
      ]),
    );
    const lunch = sample.find((t) => t.description.startsWith("Team lunch"))!;
    expect(categorize(lunch, SAMPLE_RULES)).toBe("Staff welfare"); // beats the "cafe" rule in its text
  });

  it("gives September one example of each status, with recorded literals", () => {
    const rows = varianceReport(sample, SAMPLE_RULES, SAMPLE_BUDGET, "2026-09");
    const by = Object.fromEntries(rows.map((r) => [r.category, [r.spendCents, r.status]]));
    expect(by).toMatchObject({
      Travel: [80_862, "over"],
      Utilities: [20_764, "over"],
      Meals: [46_596, "near"],
      Rent: [240_000, "near"],
      "Office supplies": [19_199, "on_track"],
      Marketing: [13_789, "on_track"],
      "Staff welfare": [12_186, "unbudgeted"],
      [UNCATEGORIZED]: [4964, "unbudgeted"],
    });
  });

  it("the refund reduces office supplies spend in September", () => {
    const withRefund = varianceReport(sample, SAMPLE_RULES, SAMPLE_BUDGET, "2026-09").find(
      (r) => r.category === "Office supplies",
    )!;
    const without = varianceReport(
      sample.filter((t) => t.amountCents < 0),
      SAMPLE_RULES,
      SAMPLE_BUDGET,
      "2026-09",
    ).find((r) => r.category === "Office supplies")!;
    expect(without.spendCents - withRefund.spendCents).toBe(3400);
  });

  it("every budget category is a real category, and the rules point only at budgeted categories", () => {
    for (const r of SAMPLE_RULES) expect(r.category in SAMPLE_BUDGET.monthlyCents).toBe(true);
    expect(
      Object.values(SAMPLE_BUDGET.monthlyCents).every((c) => Number.isInteger(c) && c > 0),
    ).toBe(true);
  });
});

describe("transactions-sample.csv fixture", () => {
  it("imports to exactly the generated transactions", () => {
    const r = importTransactions(fixture);
    expect(r.ok && r.value).toEqual(sample);
  });
});
