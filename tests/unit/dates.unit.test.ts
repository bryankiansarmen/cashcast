import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  addDays,
  diffDays,
  fromDayNumber,
  parseDate,
  toDayNumber,
  weekRange,
} from "../../src/engine/dates";

describe("parseDate", () => {
  it.each([
    ["2026-09-30", "2026-09-30"],
    ["9/30/2026", "2026-09-30"],
    ["09/05/2026", "2026-09-05"],
    [" 2026-01-01 ", "2026-01-01"],
    ["2024-02-29", "2024-02-29"],
    ["2/29/2024", "2024-02-29"],
    ["2000-02-29", "2000-02-29"],
  ])("parses %j to %s", (input, iso) => {
    expect(parseDate(input)).toEqual({ ok: true, value: iso });
  });

  it.each([
    "2026-02-30",
    "2/30/2026",
    "13/1/2026",
    "2025-02-29",
    "1900-02-29",
    "2026-00-10",
    "0/5/2026",
    "5/0/2026",
    "26-09-30",
    "30/09/2026",
    "2026/09/30",
    "9/30/26",
    "",
    "abc",
  ])("rejects %j", (input) => {
    expect(parseDate(input).ok).toBe(false);
  });
});

describe("day math", () => {
  it("handles month, year and leap boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2025-02-28", 1)).toBe("2025-03-01");
    expect(diffDays("2026-10-14", "2026-09-30")).toBe(14);
    expect(diffDays("2026-09-20", "2026-09-30")).toBe(-10);
  });

  it("round-trips addDays and diffDays", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 80_000 }),
        fc.integer({ min: -5000, max: 5000 }),
        (day, n) => {
          const d = fromDayNumber(day);
          const shifted = addDays(d, n);
          expect(diffDays(shifted, d)).toBe(n);
          expect(addDays(shifted, -n)).toBe(d);
          expect(toDayNumber(d)).toBe(day);
          expect(parseDate(d)).toEqual({ ok: true, value: d });
        },
      ),
    );
  });
});

describe("weekRange", () => {
  it("matches the week definition", () => {
    expect(weekRange("2026-09-30", 1)).toEqual({ start: "2026-10-01", end: "2026-10-07" });
    expect(weekRange("2026-09-30", 2)).toEqual({ start: "2026-10-08", end: "2026-10-14" });
    expect(weekRange("2026-09-30", 13)).toEqual({ start: "2026-12-24", end: "2026-12-30" });
  });

  it("tiles the 91-day horizon with no gaps", () => {
    for (let n = 1; n < 13; n++) {
      expect(diffDays(weekRange("2026-09-30", n + 1).start, weekRange("2026-09-30", n).end)).toBe(
        1,
      );
    }
  });
});
