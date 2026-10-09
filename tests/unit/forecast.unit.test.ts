import { describe, expect, it } from "vitest";
import { DEFAULT_CURVES } from "../../src/engine/curves";
import { distribute } from "../../src/engine/forecast";
import { DEFAULT_SCENARIOS } from "../../src/engine/scenarios";
import type { Assumptions, Invoice } from "../../src/engine/types";

const asOf = "2026-09-30";
const assumptions = (customers: Assumptions["customers"] = {}): Assumptions => ({
  version: 1,
  curves: DEFAULT_CURVES,
  scenarios: DEFAULT_SCENARIOS,
  customers,
});
const invoice = (dueDate: string, dollars: number, customerKey = "acme"): Invoice => ({
  id: "1",
  invoiceNumber: "",
  customerKey,
  customerName: customerKey,
  dueDate,
  openCents: dollars * 100,
});
const inDollars = (v: number[]) => v.map((c) => c / 100);
const expectDollars = (actual: number[], dollars: number[]) => {
  expect(actual).toHaveLength(13);
  dollars.forEach((d, i) => expect(actual[i] / 100).toBeCloseTo(d, 6));
  for (let i = dollars.length; i < 13; i++) expect(actual[i]).toBeCloseTo(0, 6);
};

const A = invoice("2026-09-20", 10_000);
const B = invoice("2026-10-14", 20_000, "beta");

describe("distribute: worked example", () => {
  it("invoice A, expected", () => {
    expectDollars(
      distribute(A, assumptions(), "expected", asOf),
      [3000, 2000, 1200, 800, 500, 300, 200, 100],
    );
  });

  it("invoice B, expected (customer delay 1 week)", () => {
    const v = distribute(B, assumptions({ beta: { delayWeeks: 1 } }), "expected", asOf);
    expectDollars(v, [0, 0, 8000, 4000, 2400, 1600, 1000, 600, 400, 200]);
  });

  it("invoice A, worst (factor 0.8, 2 extra weeks)", () => {
    const v = distribute(A, assumptions(), "worst", asOf);
    expectDollars(v, [0, 0, 2400, 1600, 960, 640, 400, 240, 160, 80]);
    expect(inDollars(v).reduce((a, b) => a + b, 0)).toBeCloseTo(6480, 6);
  });

  it("invoice A, best (factor 1.1)", () => {
    const v = distribute(A, assumptions(), "best", asOf);
    expectDollars(v, [3300, 2200, 1320, 880, 550, 330, 220, 110]);
    expect(inDollars(v).reduce((a, b) => a + b, 0)).toBeCloseTo(8910, 6);
  });
});

describe("distribute: edges", () => {
  it("due beyond the horizon gives all zeros", () => {
    expect(distribute(invoice("2027-01-01", 1000), assumptions(), "expected", asOf)).toEqual(
      new Array(13).fill(0),
    );
  });

  it("delay pushing amounts past week 13 drops them", () => {
    const v = distribute(A, assumptions({ acme: { delayWeeks: 8 } }), "worst", asOf); // starts week 11
    expectDollars(v, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2400, 1600, 960]);
  });

  it("curveSum 0 gives zeros", () => {
    const a = { ...assumptions(), curves: { ...DEFAULT_CURVES, d1_30: new Array(13).fill(0) } };
    expect(distribute(A, a, "expected", asOf)).toEqual(new Array(13).fill(0));
  });

  it("applies customer reliability", () => {
    const v = distribute(A, assumptions({ acme: { reliability: 0.5 } }), "expected", asOf);
    expectDollars(v, [1500, 1000, 600, 400, 250, 150, 100, 50]);
  });

  it("is deterministic across calls", () => {
    expect(distribute(A, assumptions(), "best", asOf)).toEqual(
      distribute(A, assumptions(), "best", asOf),
    );
  });
});
