import { describe, expect, it } from "vitest";
import { DEFAULT_CURVES, validateCurve } from "../../src/engine/curves";
import {
  DEFAULT_SCENARIOS,
  validateAssumptions,
  validateCustomers,
  validateScenarios,
} from "../../src/engine/scenarios";
import type { Assumptions, BucketId } from "../../src/engine/types";

const sum = (c: readonly number[]) => c.reduce((a, b) => a + b, 0);
const defaults = (): Assumptions => ({
  version: 1,
  curves: { ...DEFAULT_CURVES },
  scenarios: structuredClone(DEFAULT_SCENARIOS),
  customers: {},
});

describe("default curves", () => {
  it.each<[BucketId, number]>([
    ["current", 0.91],
    ["d1_30", 0.81],
    ["d31_60", 0.65],
    ["d61_90", 0.46],
    ["d91_plus", 0.23],
  ])("%s sums to %d and is valid", (bucket, expected) => {
    expect(sum(DEFAULT_CURVES[bucket])).toBeCloseTo(expected, 10);
    expect(validateCurve(DEFAULT_CURVES[bucket])).toEqual([]);
  });

  it("defaults pass whole-assumption validation", () => {
    expect(validateAssumptions(defaults())).toEqual([]);
  });
});

describe("validateCurve", () => {
  const ok = DEFAULT_CURVES.current;
  it.each<[string, number[]]>([
    ["length 12", ok.slice(0, 12)],
    ["length 14", [...ok, 0]],
    ["a negative value", [-0.1, ...ok.slice(1)]],
    ["a value above 1", [1.5, ...Array(12).fill(0)]],
    ["sum 1.01", [0.51, 0.5, ...Array(11).fill(0)]],
    ["NaN", [NaN, ...ok.slice(1)]],
    ["Infinity", [Infinity, ...ok.slice(1)]],
  ])("rejects %s with a readable message", (_name, curve) => {
    const errors = validateCurve(curve);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/^Curve /);
  });

  it("accepts sum exactly 1, including float noise", () => {
    expect(validateCurve([...Array(10).fill(0.1), 0, 0, 0])).toEqual([]);
    expect(validateCurve([1, ...Array(12).fill(0)])).toEqual([]);
  });
});

describe("validateScenarios", () => {
  const withScenario = (id: "best" | "expected" | "worst", patch: object) => {
    const s = structuredClone(DEFAULT_SCENARIOS);
    s[id] = { ...s[id], ...patch };
    return s;
  };

  it("accepts defaults", () => expect(validateScenarios(DEFAULT_SCENARIOS)).toEqual([]));

  it.each([
    [
      "best below expected factor",
      withScenario("best", { factor: 0.9 }),
      /best ≥ expected ≥ worst/,
    ],
    [
      "worst above expected factor",
      withScenario("worst", { factor: 1.05 }),
      /best ≥ expected ≥ worst/,
    ],
    [
      "worst delay below expected",
      withScenario("expected", { extraDelayWeeks: 3 }),
      /best ≤ expected ≤ worst/,
    ],
    ["factor out of bounds", withScenario("best", { factor: 1.6 }), /best factor/],
    ["factor below bounds", withScenario("worst", { factor: 0.4 }), /worst factor/],
    ["delay above 4", withScenario("worst", { extraDelayWeeks: 5 }), /worst extra delay/],
    ["fractional delay", withScenario("worst", { extraDelayWeeks: 1.5 }), /worst extra delay/],
    ["NaN factor", withScenario("expected", { factor: NaN }), /expected factor/],
  ])("rejects %s", (_name, s, message) => {
    expect(validateScenarios(s).join(" ")).toMatch(message);
  });
});

describe("validateCustomers", () => {
  it("accepts bounds and absent fields", () => {
    expect(
      validateCustomers({
        a: {},
        b: { delayWeeks: 8, reliability: 0 },
        c: { delayWeeks: 0, reliability: 1 },
      }),
    ).toEqual([]);
  });

  it.each([
    [{ delayWeeks: 9 }, /delay/],
    [{ delayWeeks: -1 }, /delay/],
    [{ delayWeeks: 1.5 }, /delay/],
    [{ reliability: 1.1 }, /reliability/],
    [{ reliability: -0.1 }, /reliability/],
    [{ reliability: NaN }, /reliability/],
  ])("rejects %j", (adj, message) => {
    expect(validateCustomers({ acme: adj }).join(" ")).toMatch(message);
  });
});

describe("validateAssumptions", () => {
  it("aggregates errors from curves, scenarios, and customers", () => {
    const a = defaults();
    a.curves = { ...a.curves, d1_30: a.curves.d1_30.slice(0, 12) };
    a.scenarios.worst.extraDelayWeeks = 9;
    a.customers = { acme: { delayWeeks: 9 } };
    const text = validateAssumptions(a).join("\n");
    expect(text).toMatch(/d1_30 curve/);
    expect(text).toMatch(/worst extra delay/);
    expect(text).toMatch(/acme/);
  });

  it("rejects an unknown version", () => {
    expect(validateAssumptions({ ...defaults(), version: 2 as unknown as 1 })).toHaveLength(1);
  });
});
