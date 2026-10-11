import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as engine from "../../src/engine";
import { agingSummary } from "../../src/engine/aging";

const asOf = "2026-09-30";
const invoices: engine.Invoice[] = [
  {
    id: "1",
    invoiceNumber: "",
    customerKey: "acme",
    customerName: "Acme",
    dueDate: "2026-09-20",
    openCents: 100_000,
  },
];
const assumptions: engine.Assumptions = {
  version: 1,
  curves: engine.DEFAULT_CURVES,
  scenarios: engine.DEFAULT_SCENARIOS,
  customers: {},
};
const results = engine.forecastAll(invoices, assumptions, asOf).results;

// One call per public engine function. The coverage test below fails when a function is added without an entry.
const calls: Record<string, () => unknown> = {
  addDays: () => engine.addDays(asOf, 3),
  agingSummary: () => engine.agingSummary(invoices, asOf),
  classify: () => engine.classify(invoices[0], asOf),
  diffDays: () => engine.diffDays(asOf, "2026-09-01"),
  distribute: () => engine.distribute(invoices[0], assumptions, "expected", asOf),
  forecast: () => engine.forecast(invoices, assumptions, "expected", asOf),
  forecastAll: () => engine.forecastAll(invoices, assumptions, asOf),
  fromDayNumber: () => engine.fromDayNumber(20_000),
  parseDate: () => engine.parseDate("9/30/2026"),
  parseMoneyToCents: () => engine.parseMoneyToCents("$1,234.56"),
  reconcile: () =>
    engine.reconcile({ invoices, assumptions, asOf, aging: agingSummary(invoices, asOf), results }),
  toDayNumber: () => engine.toDayNumber(asOf),
  validateAssumptions: () => engine.validateAssumptions(assumptions),
  validateCurve: () => engine.validateCurve(engine.DEFAULT_CURVES.current),
  validateCustomers: () => engine.validateCustomers({ acme: { delayWeeks: 1 } }),
  validateScenarios: () => engine.validateScenarios(engine.DEFAULT_SCENARIOS),
  weekRange: () => engine.weekRange(asOf, 1),
};

describe("engine purity (INV-01)", () => {
  const RealDate = Date;
  beforeEach(() => {
    // Any read of the system clock (Date.now, new Date(), Date()) throws.
    const forbidden = () => {
      throw new Error("Engine read the system clock");
    };
    class NoClockDate extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) forbidden();
        super(...(args as [number]));
      }
      static override now = forbidden;
    }
    vi.stubGlobal("Date", NoClockDate);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("has a call entry for every public engine function", () => {
    const fns = Object.entries(engine)
      .filter(([, v]) => typeof v === "function")
      .map(([k]) => k);
    expect(fns.sort()).toEqual(Object.keys(calls).sort());
  });

  it.each(Object.keys(calls))("%s never reads the clock", (name) => {
    expect(calls[name]).not.toThrow();
  });

  it("the clock stub really throws", () => {
    expect(() => new Date()).toThrow("system clock");
    expect(() => Date.now()).toThrow("system clock");
  });
});
