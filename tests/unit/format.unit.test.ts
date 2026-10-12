import { describe, expect, it } from "vitest";
import { formatCurrency, formatPercent } from "../../src/viewmodels/format";
import { sortRows } from "../../src/viewmodels/table";

describe("formatCurrency", () => {
  it.each([
    [0, "$0"],
    [123_456, "$1,235"],
    [123_400, "$1,234"],
    [1_000_000_000, "$10,000,000"],
    [99, "$1"],
    [49, "$0"],
  ])("%d cents is %s", (cents, text) => expect(formatCurrency(cents)).toBe(text));

  it("rounds halves away from zero, for positives and negatives alike", () => {
    expect(formatCurrency(50)).toBe("$1");
    expect(formatCurrency(150)).toBe("$2");
    expect(formatCurrency(250)).toBe("$3");
    expect(formatCurrency(-50)).toBe("-$1");
    expect(formatCurrency(-150)).toBe("-$2");
    expect(formatCurrency(-250)).toBe("-$3");
  });

  it("formats negatives with a leading minus and never shows negative zero", () => {
    expect(formatCurrency(-123_456)).toBe("-$1,235");
    expect(formatCurrency(-49)).toBe("$0");
    expect(formatCurrency(-0)).toBe("$0");
  });

  it("rounds fractional cents from the engine only when displayed", () => {
    expect(formatCurrency(12_345.4)).toBe("$123");
    expect(formatCurrency(12_349.9)).toBe("$123");
    expect(formatCurrency(12_350.1)).toBe("$124");
  });
});

describe("formatPercent", () => {
  it.each([
    [0, "0%"],
    [1, "100%"],
    [0.256, "26%"],
    [0.254, "25%"],
    [1.1, "110%"],
  ])("%d is %s", (ratio, text) => expect(formatPercent(ratio)).toBe(text));

  it("rounds halves away from zero, including negatives", () => {
    expect(formatPercent(0.125)).toBe("13%");
    expect(formatPercent(0.375)).toBe("38%");
    expect(formatPercent(-0.125)).toBe("-13%");
    expect(formatPercent(-0.004)).toBe("0%");
  });
});

describe("sortRows", () => {
  const rows = [
    { n: "b", v: 10 },
    { n: "a", v: 2 },
    { n: "c", v: 10 },
  ];

  it("sorts numbers numerically in both directions, keeping ties in original order", () => {
    expect(sortRows(rows, (r) => r.v, "asc").map((r) => r.n)).toEqual(["a", "b", "c"]);
    expect(sortRows(rows, (r) => r.v, "desc").map((r) => r.n)).toEqual(["b", "c", "a"]);
  });

  it("sorts strings alphabetically and does not mutate the input", () => {
    const copy = [...rows];
    expect(sortRows(rows, (r) => r.n, "desc").map((r) => r.n)).toEqual(["c", "b", "a"]);
    expect(rows).toEqual(copy);
  });

  it("handles an empty list", () => {
    expect(sortRows([], () => 0, "asc")).toEqual([]);
  });
});
