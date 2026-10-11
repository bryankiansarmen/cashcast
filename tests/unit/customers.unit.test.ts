import { describe, expect, it } from "vitest";
import { DEFAULT_CURVES } from "../../src/engine/curves";
import { applyDerivedDelays, deriveCustomerDelays } from "../../src/engine/customers";
import { addDays } from "../../src/engine/dates";
import { DEFAULT_SCENARIOS, validateAssumptions } from "../../src/engine/scenarios";
import type { Assumptions, PaidInvoice } from "../../src/engine/types";

const due = "2026-01-01";
// Each entry is days paid after the due date (negative = early).
const paid = (customerKey: string, daysAfterDue: number[]): PaidInvoice[] =>
  daysAfterDue.map((d) => ({ customerKey, dueDate: due, paidDate: addDays(due, d) }));
const delay = (days: number[]) => deriveCustomerDelays(paid("acme", days)).acme;

describe("deriveCustomerDelays", () => {
  it("rounds half up: mean late 24.5 days is 3.5 weeks, so 4", () => {
    expect(delay([24, 25, 24, 25])).toEqual({
      delayWeeks: 4,
      paidCount: 4,
      insufficientHistory: false,
    });
  });

  it.each([
    [[0, 0, 0], 0],
    [[10, 10, 10], 1], // 1.43 weeks
    [[17, 17, 17], 2], // 2.43
    [[7, 7, 7], 1],
    [[10, 11, 10], 1],
    [[24, 24, 25], 3], // 3.48
    [[100, 100, 100], 8], // 14.3 clamped
    [[56, 56, 56], 8],
    [[200, 0, 0], 8], // 9.5 clamped
  ])("late days %j give %d weeks", (days, weeks) => {
    expect(delay(days).delayWeeks).toBe(weeks);
  });

  it("counts early payments as 0 days late", () => {
    expect(delay([-30, -5, 0]).delayWeeks).toBe(0);
    expect(delay([-30, 14, 14]).delayWeeks).toBe(1); // (0 + 14 + 14) / 3 = 9.3 days
  });

  it("flags fewer than 3 paid invoices as insufficient history with delay 0", () => {
    expect(delay([60, 60])).toEqual({ delayWeeks: 0, paidCount: 2, insufficientHistory: true });
    expect(delay([60])).toEqual({ delayWeeks: 0, paidCount: 1, insufficientHistory: true });
  });

  it("derives per customer and returns nothing for no history", () => {
    const d = deriveCustomerDelays([...paid("a", [14, 14, 14]), ...paid("b", [14])]);
    expect(d.a.delayWeeks).toBe(2);
    expect(d.b.insufficientHistory).toBe(true);
    expect(deriveCustomerDelays([])).toEqual({});
  });
});

describe("applyDerivedDelays", () => {
  const base: Assumptions = {
    version: 1,
    curves: DEFAULT_CURVES,
    scenarios: DEFAULT_SCENARIOS,
    customers: { manual: { delayWeeks: 5, reliability: 0.9 }, rel: { reliability: 0.5 } },
  };
  const derived = deriveCustomerDelays([
    ...paid("manual", [14, 14, 14]),
    ...paid("rel", [14, 14, 14]),
    ...paid("fresh", [21, 21, 21]),
    ...paid("thin", [60, 60]),
  ]);

  it("keeps manual delay overrides and fills the rest", () => {
    const out = applyDerivedDelays(base, derived);
    expect(out.customers.manual).toEqual({ delayWeeks: 5, reliability: 0.9 });
    expect(out.customers.rel).toEqual({ delayWeeks: 2, reliability: 0.5 });
    expect(out.customers.fresh).toEqual({ delayWeeks: 3 });
  });

  it("does not add entries for customers with insufficient history", () => {
    expect(applyDerivedDelays(base, derived).customers.thin).toBeUndefined();
  });

  it("does not mutate its input and returns valid assumptions", () => {
    const snapshot = structuredClone(base);
    const out = applyDerivedDelays(base, derived);
    expect(base).toEqual(snapshot);
    expect(out).not.toBe(base);
    expect(validateAssumptions(out)).toEqual([]);
  });
});
