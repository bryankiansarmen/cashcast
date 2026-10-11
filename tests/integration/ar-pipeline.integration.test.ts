import { describe, expect, it } from "vitest";
import { applyDerivedDelays, deriveCustomerDelays } from "../../src/engine/customers";
import { DEFAULT_CURVES } from "../../src/engine/curves";
import { forecast } from "../../src/engine/forecast";
import { forecastAll } from "../../src/engine/forecast-all";
import { DEFAULT_SCENARIOS, validateAssumptions } from "../../src/engine/scenarios";
import type { Assumptions } from "../../src/engine/types";
import { importArAging } from "../../src/importers/ar-aging";
import { importPaymentHistory } from "../../src/importers/payment-history";
import { generateArSample } from "../../src/sample/ar-sample";
import { SAMPLE_AS_OF } from "../../src/sample/constants";
import history from "../fixtures/history-sample.csv?raw";
import quickbooks from "../fixtures/ar-quickbooks-style.csv?raw";

const asOf = "2026-09-30";
const base: Assumptions = {
  version: 1,
  curves: DEFAULT_CURVES,
  scenarios: DEFAULT_SCENARIOS,
  customers: {},
};
const SCENARIOS = ["best", "expected", "worst"] as const;

const arImport = importArAging(quickbooks, asOf);
if (!arImport.ok) throw new Error(JSON.stringify(arImport.errors));
const invoices = arImport.value;

describe("AR pipeline: fixture CSV to reconciled forecast", () => {
  it("imports, forecasts all three scenarios, and reconciles", () => {
    expect(validateAssumptions(base)).toEqual([]);
    const { results, failures } = forecastAll(invoices, base, asOf);
    expect(failures).toEqual([]);
    for (const s of SCENARIOS) expect(results[s].weeks).toHaveLength(13);
  });

  it("total open AR equals the sum of the CSV's valid open amounts", () => {
    // $12,450.00 + $3,200.50 + $8,900.00 + $21,000.00 + $975.25, typed from the file.
    const csvTotal = 1_245_000 + 320_050 + 890_000 + 2_100_000 + 97_525;
    const { results } = forecastAll(invoices, base, asOf);
    for (const s of SCENARIOS) expect(results[s].totalOpenCents).toBe(csvTotal);
  });

  it("applying history changes the affected customer's profile and nothing else", () => {
    const h = importPaymentHistory(history);
    if (!h.ok) throw new Error(JSON.stringify(h.errors));
    const withHistory = applyDerivedDelays(base, deriveCustomerDelays(h.value));
    expect(validateAssumptions(withHistory)).toEqual([]);

    const profile = (a: Assumptions, customerKey: string) =>
      forecast(
        invoices.filter((i) => i.customerKey === customerKey),
        a,
        "expected",
        asOf,
      ).weeks.map((w) => w.inflowCents);

    const keys = [...new Set(invoices.map((i) => i.customerKey))];
    const changed = keys.filter(
      (k) => JSON.stringify(profile(base, k)) !== JSON.stringify(profile(withHistory, k)),
    );
    expect(changed).toEqual(["alder & pine llc"]); // the only customer present in both files

    const { failures } = forecastAll(invoices, withHistory, asOf);
    expect(failures).toEqual([]);
  });

  it("the sample AR data reconciles too", () => {
    expect(forecastAll(generateArSample(), base, SAMPLE_AS_OF).failures).toEqual([]);
  });
});
