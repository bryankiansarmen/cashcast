import { describe, expect, it } from "vitest";
import { agingSummary, BUCKET_IDS, classify } from "../../src/engine/aging";
import { addDays } from "../../src/engine/dates";
import type { Invoice } from "../../src/engine/types";

const asOf = "2026-09-30";

describe("classify", () => {
  it.each([
    [0, "current"],
    [1, "d1_30"],
    [30, "d1_30"],
    [31, "d31_60"],
    [60, "d31_60"],
    [61, "d61_90"],
    [90, "d61_90"],
    [91, "d91_plus"],
    [400, "d91_plus"],
  ])("daysPastDue %d is %s with startWeek 1 when overdue", (daysPastDue, bucket) => {
    const r = classify({ dueDate: addDays(asOf, -daysPastDue) }, asOf);
    expect(r.bucket).toBe(bucket);
    expect(r.startWeek).toBe(1);
  });

  it.each([
    [0, 1],
    [1, 1],
    [7, 1],
    [8, 2],
    [14, 2],
    [15, 3],
    [91, 13],
    [92, 14],
  ])("due in %d days gives current with startWeek %d", (daysUntilDue, startWeek) => {
    expect(classify({ dueDate: addDays(asOf, daysUntilDue) }, asOf)).toEqual({
      bucket: "current",
      startWeek,
    });
  });
});

const inv = (customerName: string, daysPastDue: number, openCents: number): Invoice => ({
  id: `${customerName}-${daysPastDue}-${openCents}`,
  invoiceNumber: "",
  customerKey: customerName.toLowerCase(),
  customerName,
  dueDate: addDays(asOf, -daysPastDue),
  openCents,
});

describe("agingSummary", () => {
  it("returns zeros for empty input", () => {
    const s = agingSummary([], asOf);
    expect(s.totalCents).toBe(0);
    expect(s.customers).toEqual([]);
    for (const b of BUCKET_IDS) expect(s.buckets[b]).toEqual({ totalCents: 0, count: 0 });
  });

  it("buckets, counts, and reconciles to total open AR (R2)", () => {
    const s = agingSummary(
      [
        inv("Acme", -5, 100),
        inv("Acme", 10, 200),
        inv("Beta", 10, 300),
        inv("Beta", 95, 400),
        inv("Gamma", 45, 50),
      ],
      asOf,
    );
    expect(s.buckets.current).toEqual({ totalCents: 100, count: 1 });
    expect(s.buckets.d1_30).toEqual({ totalCents: 500, count: 2 });
    expect(s.buckets.d31_60).toEqual({ totalCents: 50, count: 1 });
    expect(s.buckets.d61_90).toEqual({ totalCents: 0, count: 0 });
    expect(s.buckets.d91_plus).toEqual({ totalCents: 400, count: 1 });
    expect(BUCKET_IDS.reduce((sum, b) => sum + s.buckets[b].totalCents, 0)).toBe(s.totalCents);
    expect(s.totalCents).toBe(1050);
  });

  it("sorts customers by total desc then name, with a per-bucket matrix", () => {
    const s = agingSummary(
      [inv("Zed", 10, 100), inv("Amy", 10, 100), inv("Big", 10, 300), inv("Big", 95, 50)],
      asOf,
    );
    expect(s.customers.map((c) => c.customerName)).toEqual(["Big", "Amy", "Zed"]);
    expect(s.customers[0].totalCents).toBe(350);
    expect(s.customers[0].byBucketCents).toEqual({
      current: 0,
      d1_30: 300,
      d31_60: 0,
      d61_90: 0,
      d91_plus: 50,
    });
  });

  it("merges a customer by key and keeps first-seen casing", () => {
    const s = agingSummary(
      [inv("Acme", 10, 100), { ...inv("ACME", 10, 100), customerKey: "acme" }],
      asOf,
    );
    expect(s.customers).toHaveLength(1);
    expect(s.customers[0]).toMatchObject({ customerName: "Acme", totalCents: 200 });
  });
});
