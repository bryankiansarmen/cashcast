import { describe, expect, it } from "vitest";
import { deriveCustomerDelays } from "../../src/engine/customers";
import { importArAging } from "../../src/importers/ar-aging";
import { importPaymentHistory } from "../../src/importers/payment-history";

const ok = (text: string) => {
  const r = importPaymentHistory(text);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r;
};
const errorsOf = (text: string) => {
  const r = importPaymentHistory(text);
  if (r.ok) throw new Error("expected errors");
  return r.errors;
};

describe("importPaymentHistory", () => {
  it.each(["Paid Date", "Payment Date", "Date Paid"])("maps the %s header", (header) => {
    const { value } = ok(`Customer,Due Date,${header}\nAcme,2026-01-01,2026-01-10\n`);
    expect(value).toEqual([{ customerKey: "acme", dueDate: "2026-01-01", paidDate: "2026-01-10" }]);
  });

  it("accepts US dates and an early payment", () => {
    const { value } = ok("Customer,Due Date,Paid Date\nAcme,1/15/2026,1/5/2026\n");
    expect(value[0]).toEqual({
      customerKey: "acme",
      dueDate: "2026-01-15",
      paidDate: "2026-01-05",
    });
  });

  it("reports rows missing a date with line and column", () => {
    const errors = errorsOf(
      "Customer,Due Date,Paid Date\nAcme,2026-01-01,\nBeta,,2026-01-05\nGamma,2026-01-01,2026-01-09\n",
    );
    expect(errors.map((e) => [e.line, e.column])).toEqual([
      [2, "paidDate"],
      [3, "dueDate"],
    ]);
  });

  it("reports an invalid date and an empty customer, with no partial dataset", () => {
    const errors = errorsOf(
      "Customer,Due Date,Paid Date\n,2026-01-01,2026-01-05\nAcme,2026-02-30,2026-03-01\nBeta,2026-01-01,2026-01-09\n",
    );
    expect(errors.map((e) => [e.line, e.column])).toEqual([
      [2, "customer"],
      [3, "dueDate"],
    ]);
  });

  it("errors on a missing required column, listing aliases", () => {
    const errors = errorsOf("Customer,Due Date\nAcme,2026-01-01\n");
    expect(errors[0]).toMatchObject({ line: 1, column: "paidDate" });
    expect(errors[0].message).toContain("payment date");
  });

  it.each(["", "Customer,Due Date,Paid Date\n"])(
    "errors on an empty or header-only file %j",
    (text) => {
      expect(errorsOf(text).length).toBeGreaterThan(0);
    },
  );

  it("uses the same customerKey as the AR importer so delays apply", () => {
    const history = ok("Customer,Due Date,Paid Date\n  ACME   Corp ,2026-01-01,2026-01-10\n")
      .value[0];
    const ar = importArAging(
      "Customer,Due Date,Open Balance\nAcme Corp,2026-10-01,100\n",
      "2026-09-30",
    );
    expect(ar.ok && ar.value[0].customerKey).toBe(history.customerKey);
  });

  it("feeds delay derivation: three invoices 14 days late give 2 weeks", () => {
    const rows = [1, 2, 3].map((d) => `Acme,2026-01-0${d},2026-01-${14 + d}`).join("\n");
    const { value } = ok(`Customer,Due Date,Paid Date\n${rows}\n`);
    expect(deriveCustomerDelays(value).acme).toMatchObject({
      delayWeeks: 2,
      insufficientHistory: false,
    });
  });
});
