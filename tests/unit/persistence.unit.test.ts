import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CURVES } from "../../src/engine/curves";
import { loadAssumptions, saveAssumptions } from "../../src/state/persistence";
import { defaultAssumptions } from "../../src/state/store";

const KEY = "cashcast.assumptions.v1";
let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

const edited = () => {
  const a = defaultAssumptions();
  return {
    ...a,
    curves: { ...a.curves, current: [0.3, 0.2, 0.12, 0.08, 0.05, 0.03, 0.02, 0.01, 0, 0, 0, 0, 0] },
    customers: { acme: { delayWeeks: 2 } },
  };
};

describe("loadAssumptions", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(loadAssumptions()).toEqual({
      assumptions: defaultAssumptions(),
      storageUnavailable: false,
    });
  });

  it("round-trips saved edits", () => {
    expect(saveAssumptions(edited())).toBe(true);
    expect(loadAssumptions()).toEqual({ assumptions: edited(), storageUnavailable: false });
  });

  it.each([
    ["not JSON", "{oops"],
    ["null", "null"],
    ["an array", "[]"],
    ["a number", "42"],
    ["a wrong version", JSON.stringify({ ...defaultAssumptions(), version: 2 })],
    [
      "missing curves",
      JSON.stringify({ version: 1, scenarios: defaultAssumptions().scenarios, customers: {} }),
    ],
    [
      "a missing bucket",
      JSON.stringify({ ...defaultAssumptions(), curves: { current: DEFAULT_CURVES.current } }),
    ],
    [
      "a curve of length 12",
      JSON.stringify({
        ...defaultAssumptions(),
        curves: { ...DEFAULT_CURVES, current: DEFAULT_CURVES.current.slice(1) },
      }),
    ],
    [
      "a curve adding up to 1.01",
      JSON.stringify({
        ...defaultAssumptions(),
        curves: { ...DEFAULT_CURVES, current: [0.51, 0.5, ...new Array(11).fill(0)] },
      }),
    ],
    [
      "a negative curve value",
      JSON.stringify({
        ...defaultAssumptions(),
        curves: { ...DEFAULT_CURVES, current: [-0.1, ...DEFAULT_CURVES.current.slice(1)] },
      }),
    ],
    [
      "scenario ordering broken",
      JSON.stringify({
        ...defaultAssumptions(),
        scenarios: {
          ...defaultAssumptions().scenarios,
          worst: { factor: 1.4, extraDelayWeeks: 2 },
        },
      }),
    ],
    [
      "a missing scenario",
      JSON.stringify({
        ...defaultAssumptions(),
        scenarios: { best: { factor: 1.1, extraDelayWeeks: 0 } },
      }),
    ],
    [
      "delayWeeks 9",
      JSON.stringify({ ...defaultAssumptions(), customers: { acme: { delayWeeks: 9 } } }),
    ],
    [
      "reliability 1.1",
      JSON.stringify({ ...defaultAssumptions(), customers: { acme: { reliability: 1.1 } } }),
    ],
    ["a non-object customer", JSON.stringify({ ...defaultAssumptions(), customers: { acme: 5 } })],
  ])("falls back to the defaults, without an error, for %s", (_name, stored) => {
    store.set(KEY, stored);
    expect(loadAssumptions()).toEqual({
      assumptions: defaultAssumptions(),
      storageUnavailable: false,
    });
  });

  it("falls back to the defaults and reports storage as unavailable when reading throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(loadAssumptions()).toEqual({
      assumptions: defaultAssumptions(),
      storageUnavailable: true,
    });
  });

  it("falls back when localStorage itself is missing", () => {
    vi.unstubAllGlobals();
    expect(loadAssumptions().storageUnavailable).toBe(true);
  });
});

describe("saveAssumptions", () => {
  it("clears the key for default assumptions so a future change to the defaults still reaches the user", () => {
    saveAssumptions(edited());
    expect(store.has(KEY)).toBe(true);
    expect(saveAssumptions(defaultAssumptions())).toBe(true);
    expect(store.has(KEY)).toBe(false);
  });

  it("returns false instead of throwing when writing is blocked", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("quota");
      },
    });
    expect(saveAssumptions(edited())).toBe(false);
    expect(saveAssumptions(defaultAssumptions())).toBe(false);
  });

  it("stores only assumptions", () => {
    saveAssumptions(edited());
    expect([...store.keys()]).toEqual([KEY]);
    expect(Object.keys(JSON.parse(store.get(KEY)!)).sort()).toEqual([
      "curves",
      "customers",
      "scenarios",
      "version",
    ]);
  });
});
