import { describe, expect, it } from "vitest";
import { deriveCustomerDelays } from "../../src/engine/customers";
import { importPaymentHistory } from "../../src/importers/payment-history";
import { SAMPLE_CUSTOMERS } from "../../src/sample/ar-sample";
import { SAMPLE_AS_OF } from "../../src/sample/constants";
import { generateHistorySample } from "../../src/sample/history-sample";
import fixture from "../fixtures/history-sample.csv?raw";

const history = generateHistorySample();
const derived = deriveCustomerDelays(history);

describe("generateHistorySample", () => {
  it("returns deeply equal output on repeated calls", () => {
    expect(generateHistorySample()).toEqual(history);
  });

  it("has the recorded literal count and uses only sample customers", () => {
    expect(history).toHaveLength(59);
    const keys = new Set(SAMPLE_CUSTOMERS.map((n) => n.toLowerCase()));
    for (const p of history) expect(keys.has(p.customerKey)).toBe(true);
  });

  it("has every payment on or before the as-of date", () => {
    for (const p of history) expect(p.paidDate <= SAMPLE_AS_OF).toBe(true);
  });

  it("derives the recorded literal delays", () => {
    const weeks = Object.fromEntries(Object.entries(derived).map(([k, v]) => [k, v.delayWeeks]));
    expect(weeks).toEqual({
      "alder & pine llc": 3,
      "driftwood analytics": 5,
      "granite peak builders": 8,
      "kestrel freight": 2,
      "birchwood print co": 0,
      "cedar row dental": 0,
      "ember street bakery": 0,
      "fennel & co catering": 0,
      "harbor light marine": 0,
      "iron kettle foods": 0,
      "juniper bay clinic": 0,
      "lantern hill studio": 0,
    });
  });

  it("derives at least 2 weeks for the four slow customers and 0 or insufficient for the rest", () => {
    const slow = [
      "alder & pine llc",
      "driftwood analytics",
      "granite peak builders",
      "kestrel freight",
    ];
    for (const [key, d] of Object.entries(derived)) {
      if (slow.includes(key)) expect(d.delayWeeks).toBeGreaterThanOrEqual(2);
      else expect(d.delayWeeks === 0 || d.insufficientHistory).toBe(true);
    }
    expect(
      Object.entries(derived)
        .filter(([, d]) => d.insufficientHistory)
        .map(([k]) => k)
        .sort(),
    ).toEqual(["juniper bay clinic", "lantern hill studio"]);
  });
});

describe("history-sample.csv fixture", () => {
  it("imports to exactly the generated history", () => {
    const r = importPaymentHistory(fixture);
    expect(r.ok && r.value).toEqual(history);
  });
});
