import { describe, expect, it } from "vitest";
import { categorize } from "../../src/budget/categorize";
import { UNCATEGORIZED } from "../../src/budget/types";
import { monthKey, varianceReport } from "../../src/budget/variance";
import { importTransactions } from "../../src/importers/transactions";
import {
  generateTransactionSample,
  SAMPLE_BUDGET,
  SAMPLE_RULES,
} from "../../src/sample/budget-sample";
import { SAMPLE_MONTHS } from "../../src/sample/constants";
import debitCredit from "../fixtures/transactions-debit-credit.csv?raw";
import sampleCsv from "../fixtures/transactions-sample.csv?raw";

const imported = importTransactions(sampleCsv);
if (!imported.ok) throw new Error(JSON.stringify(imported.errors));
const transactions = imported.value;

describe("budget pipeline: fixture CSV to variance", () => {
  it("imports the fixture to the same transactions the sample generator produces", () => {
    expect(transactions).toEqual(generateTransactionSample());
    expect(transactions).toHaveLength(61);
  });

  it.each(SAMPLE_MONTHS)(
    "%s: category spend adds up exactly to the month's net outflow",
    (month) => {
      const rows = varianceReport(transactions, SAMPLE_RULES, SAMPLE_BUDGET, month);
      const net = transactions
        .filter((t) => monthKey(t.date) === month)
        .reduce((s, t) => s + t.amountCents, 0);
      expect(rows.reduce((s, r) => s + r.spendCents, 0)).toBe(-net);
      expect(rows.every((r) => r.month === month && Number.isInteger(r.spendCents))).toBe(true);
    },
  );

  it("September statuses and amounts match the recorded values", () => {
    const rows = varianceReport(transactions, SAMPLE_RULES, SAMPLE_BUDGET, "2026-09");
    expect(rows.map((r) => [r.category, r.spendCents, r.budgetCents, r.status])).toEqual(
      [
        ["Rent", 240_000, 240_000, "near"],
        ["Travel", 80_862, 60_000, "over"],
        ["Meals", 46_596, 50_000, "near"],
        ["Insurance", 22_500, 22_500, "near"],
        ["Utilities", 20_764, 20_000, "over"],
        ["Software", 19_100, 20_000, "near"],
        ["Office supplies", 19_199, 25_000, "on_track"],
        ["Marketing", 13_789, 40_000, "on_track"],
        ["Staff welfare", 12_186, 0, "unbudgeted"],
        [UNCATEGORIZED, 4964, 0, "unbudgeted"],
      ].sort(
        (a, b) => (b[1] as number) - (a[1] as number) || String(a[0]).localeCompare(String(b[0])),
      ),
    );
  });

  it("an over-budget category reports its variance and its three largest outflows", () => {
    const travel = varianceReport(transactions, SAMPLE_RULES, SAMPLE_BUDGET, "2026-09").find(
      (r) => r.category === "Travel",
    )!;
    expect(travel.varianceCents).toBe(20_862);
    expect(travel.variancePct).toBeCloseTo(0.3477, 4);
    expect(travel.topContributors).toHaveLength(3);
    const sizes = travel.topContributors.map((t) => Math.abs(t.amountCents));
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    expect(
      travel.topContributors.every(
        (t) => categorize(t, SAMPLE_RULES) === "Travel" && monthKey(t.date) === "2026-09",
      ),
    ).toBe(true);
  });

  it("the explicit CSV category beats the rules, and unmatched rows land in Uncategorized", () => {
    const lunch = transactions.find((t) => t.description.startsWith("Team lunch"))!;
    expect(lunch.csvCategory).toBe("Staff welfare");
    expect(categorize(lunch, SAMPLE_RULES)).toBe("Staff welfare");
    expect(
      transactions
        .filter((t) => categorize(t, SAMPLE_RULES) === UNCATEGORIZED)
        .every((t) => /Zeta|ATM/.test(t.description)),
    ).toBe(true);
  });
});

describe("budget pipeline: debit and credit file", () => {
  it("imports bank-style columns, categorizes by rule, and nets the refund against spend", () => {
    const r = importTransactions(debitCredit);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    const rows = varianceReport(r.value, SAMPLE_RULES, SAMPLE_BUDGET, "2026-07");
    const spend = Object.fromEntries(rows.map((row) => [row.category, row.spendCents]));
    expect(spend).toMatchObject({
      Rent: 240_000,
      Software: 14_900,
      Utilities: 20_150,
      [UNCATEGORIZED]: 3620,
      "Office supplies": -3400,
    });
    expect(rows.find((row) => row.category === "Office supplies")).toMatchObject({
      status: "on_track",
      varianceCents: -28_400,
    });
  });
});
