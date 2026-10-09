import { describe, expect, it } from "vitest";
import { classify } from "../../src/engine/aging";
import { addDays } from "../../src/engine/dates";

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
