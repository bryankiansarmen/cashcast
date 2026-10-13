import { afterEach, describe, expect, it, vi } from "vitest";
import { budgetStatus, monthKey, varianceReport } from "../../src/budget/variance";
import {
  UNCATEGORIZED,
  type Budget,
  type CategoryRule,
  type Transaction,
} from "../../src/budget/types";

let n = 0;
const tx = (
  date: string,
  amountCents: number,
  description = "Store",
  csvCategory?: string,
): Transaction => ({
  id: `t${++n}`,
  date,
  description,
  amountCents,
  csvCategory,
});
const budget = (monthlyCents: Record<string, number>): Budget => ({ monthlyCents });
const row = (
  txs: Transaction[],
  b: Budget,
  category: string,
  rules: CategoryRule[] = [],
  month = "2026-09",
) => varianceReport(txs, rules, b, month).find((r) => r.category === category)!;

describe("budgetStatus", () => {
  // Budget $100.00 = 10,000 cents, so spend in cents is the percentage times 100.
  it.each([
    [8999, "on_track"], // 89.99%
    [9000, "near"], // 90%
    [9500, "near"],
    [10000, "near"], // exactly the budget is not over
    [10001, "over"], // 100.01%
    [25000, "over"],
    [0, "on_track"],
    [-3000, "on_track"], // refunds exceed purchases
  ] as const)("spend %d of a 10,000 budget is %s", (spend, status) => {
    expect(budgetStatus(spend, 10000)).toBe(status);
  });

  it("is unbudgeted when the budget is 0 and spend is above 0", () => {
    expect(budgetStatus(1, 0)).toBe("unbudgeted");
    expect(budgetStatus(50000, 0)).toBe("unbudgeted");
  });

  it("with no budget and no spend, or net refunds, is on track", () => {
    expect(budgetStatus(0, 0)).toBe("on_track");
    expect(budgetStatus(-500, 0)).toBe("on_track");
  });

  it("uses exact integer comparison for the 90% line", () => {
    expect(budgetStatus(2699, 3000)).toBe("on_track");
    expect(budgetStatus(2700, 3000)).toBe("near");
    expect(budgetStatus(9_000_000_000_000, 10_000_000_000_000)).toBe("near");
    expect(budgetStatus(8_999_999_999_999, 10_000_000_000_000)).toBe("on_track");
  });
});

describe("varianceReport", () => {
  it("spend is the negative of the net amounts, and refunds reduce it", () => {
    const txs = [
      tx("2026-09-02", -5000, "Shop", "Food"),
      tx("2026-09-10", -3000, "Shop", "Food"),
      tx("2026-09-12", 2000, "Refund", "Food"),
    ];
    expect(row(txs, budget({ Food: 10000 }), "Food").spendCents).toBe(6000);
  });

  it("only counts the requested month", () => {
    const txs = [
      tx("2026-08-31", -9999, "x", "Food"),
      tx("2026-09-01", -100, "x", "Food"),
      tx("2026-09-30", -200, "x", "Food"),
      tx("2026-10-01", -9999, "x", "Food"),
    ];
    expect(row(txs, budget({}), "Food").spendCents).toBe(300);
    expect(row(txs, budget({}), "Food", [], "2026-10").spendCents).toBe(9999);
  });

  it("computes variance and variance percent against the budget", () => {
    const over = row([tx("2026-09-05", -12000, "x", "Food")], budget({ Food: 10000 }), "Food");
    expect(over).toMatchObject({
      budgetCents: 10000,
      spendCents: 12000,
      varianceCents: 2000,
      variancePct: 0.2,
      status: "over",
      month: "2026-09",
    });
    const under = row([tx("2026-09-05", -4000, "x", "Food")], budget({ Food: 10000 }), "Food");
    expect(under).toMatchObject({ varianceCents: -6000, variancePct: -0.6, status: "on_track" });
  });

  it("has no percentage when there is no budget, and calls spending there unbudgeted", () => {
    const r = row([tx("2026-09-05", -700, "x", "Gifts")], budget({}), "Gifts");
    expect(r).toMatchObject({
      budgetCents: 0,
      varianceCents: 700,
      variancePct: null,
      status: "unbudgeted",
    });
  });

  it("categorizes by CSV category, then rules, then Uncategorized", () => {
    const rules: CategoryRule[] = [{ id: "r", contains: "uber", category: "Travel" }];
    const txs = [
      tx("2026-09-01", -100, "UBER trip"),
      tx("2026-09-02", -200, "Uber eats", "Food"),
      tx("2026-09-03", -400, "Mystery"),
    ];
    const report = varianceReport(txs, rules, budget({}), "2026-09");
    expect(Object.fromEntries(report.map((r) => [r.category, r.spendCents]))).toEqual({
      Travel: 100,
      Food: 200,
      [UNCATEGORIZED]: 400,
    });
  });

  it("always includes Uncategorized, even with no transactions", () => {
    const r = varianceReport([], [], budget({}), "2026-09");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      category: UNCATEGORIZED,
      spendCents: 0,
      budgetCents: 0,
      status: "on_track",
      topContributors: [],
    });
  });

  it("includes budgeted categories that have no spending this month", () => {
    const r = row([], budget({ Rent: 200000 }), "Rent");
    expect(r).toMatchObject({
      spendCents: 0,
      varianceCents: -200000,
      variancePct: -1,
      status: "on_track",
    });
  });

  it("orders rows by spend, largest first, then by name", () => {
    const txs = [
      tx("2026-09-01", -100, "x", "B"),
      tx("2026-09-01", -300, "x", "C"),
      tx("2026-09-01", -100, "x", "A"),
    ];
    expect(varianceReport(txs, [], budget({ Z: 0 }), "2026-09").map((r) => r.category)).toEqual([
      "C",
      "A",
      "B",
      UNCATEGORIZED,
      "Z",
    ]);
  });

  it("reflects each status end to end", () => {
    const b = budget({ Quiet: 10000, Close: 10000, Over: 10000 });
    const txs = [
      tx("2026-09-01", -8999, "x", "Quiet"),
      tx("2026-09-01", -9000, "x", "Close"),
      tx("2026-09-01", -10001, "x", "Over"),
      tx("2026-09-01", -1, "x", "New"),
    ];
    const status = Object.fromEntries(
      varianceReport(txs, [], b, "2026-09").map((r) => [r.category, r.status]),
    );
    expect(status).toMatchObject({
      Quiet: "on_track",
      Close: "near",
      Over: "over",
      New: "unbudgeted",
    });
  });
});

describe("top contributors", () => {
  const top = (txs: Transaction[]) => row(txs, budget({}), "Food").topContributors.map((t) => t.id);
  const food = (date: string, cents: number) => tx(date, cents, "x", "Food");

  it("returns the 3 largest outflows by absolute amount, largest first", () => {
    const [a, b, c, d, e] = [
      food("2026-09-01", -100),
      food("2026-09-02", -900),
      food("2026-09-03", -500),
      food("2026-09-04", -700),
      food("2026-09-05", -50),
    ];
    expect(top([a, b, c, d, e])).toEqual([b.id, d.id, c.id]);
  });

  it("breaks ties by earlier date, then by input order", () => {
    const late = food("2026-09-20", -500);
    const early = food("2026-09-05", -500);
    const sameDayFirst = food("2026-09-05", -500);
    const sameDaySecond = food("2026-09-05", -500);
    expect(top([late, sameDayFirst, early, sameDaySecond])).toEqual([
      sameDayFirst.id,
      early.id,
      sameDaySecond.id,
    ]);
  });

  it("ignores inflows and refunds, and returns fewer than 3 when there are fewer outflows", () => {
    const out = food("2026-09-01", -100);
    expect(top([food("2026-09-02", 9999), out])).toEqual([out.id]);
    expect(top([food("2026-09-02", 9999)])).toEqual([]);
  });

  it("only looks at the same category and month", () => {
    const mine = food("2026-09-01", -100);
    const otherMonth = food("2026-10-01", -9999);
    const otherCategory = tx("2026-09-01", -9999, "x", "Travel");
    expect(top([mine, otherMonth, otherCategory])).toEqual([mine.id]);
  });
});

describe("purity", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("never reads the clock, never mutates its inputs, and is deterministic", () => {
    const RealDate = Date;
    const forbidden = () => {
      throw new Error("read the system clock");
    };
    class NoClock extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) forbidden();
        super(...(args as [number]));
      }
      static override now = forbidden;
    }
    vi.stubGlobal("Date", NoClock);
    const txs = [tx("2026-09-01", -100, "Uber"), tx("2026-09-02", -200, "Shop", "Food")];
    const rules: CategoryRule[] = [{ id: "r", contains: "uber", category: "Travel" }];
    const b = budget({ Food: 150 });
    const snapshot = structuredClone({ txs, rules, b });
    const first = varianceReport(txs, rules, b, "2026-09");
    expect(varianceReport(txs, rules, b, "2026-09")).toEqual(first);
    expect({ txs, rules, b }).toEqual(snapshot);
    expect(monthKey("2026-09-30")).toBe("2026-09");
  });
});
