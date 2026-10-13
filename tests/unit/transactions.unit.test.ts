import { describe, expect, it } from "vitest";
import { importTransactions } from "../../src/importers/transactions";
import debitCredit from "../fixtures/transactions-debit-credit.csv?raw";
import malformed from "../fixtures/transactions-malformed.csv?raw";

const ok = (text: string) => {
  const r = importTransactions(text);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r;
};
const errorsOf = (text: string) => {
  const r = importTransactions(text);
  if (r.ok) throw new Error("expected errors");
  return r.errors;
};
const SIGNED = "Date,Description,Amount,Category\n";
const DC = "Date,Description,Debit,Credit\n";

describe("signed amount file", () => {
  it("imports negative amounts as money out and positive as money in", () => {
    const { value } = ok(
      `${SIGNED}2026-07-01,Rent,-2400.00,Housing\n2026-07-02,Refund,34.50,\n2026-07-03,Shop,(12.05),\n`,
    );
    expect(value).toEqual([
      {
        id: "txn-2",
        date: "2026-07-01",
        description: "Rent",
        amountCents: -240_000,
        csvCategory: "Housing",
      },
      { id: "txn-3", date: "2026-07-02", description: "Refund", amountCents: 3450 },
      { id: "txn-4", date: "2026-07-03", description: "Shop", amountCents: -1205 },
    ]);
  });

  it("accepts ISO and US dates, thousands separators, and $ signs", () => {
    const { value } = ok(`${SIGNED}7/4/2026,A,"-$1,234.56",\n2026-07-05,B,-1,\n`);
    expect(value.map((t) => [t.date, t.amountCents])).toEqual([
      ["2026-07-04", -123_456],
      ["2026-07-05", -100],
    ]);
  });

  it("trims and collapses descriptions, drops blank categories, and keeps HTML as plain text", () => {
    const { value } = ok(
      `${SIGNED}2026-07-01,  Daily   Grind  Cafe ,-5,  \n2026-07-02,<img src=x onerror=alert(1)>,-5,\n`,
    );
    expect(value[0]).toEqual({
      id: "txn-2",
      date: "2026-07-01",
      description: "Daily Grind Cafe",
      amountCents: -500,
    });
    expect("csvCategory" in value[0]).toBe(false);
    expect(value[1].description).toBe("<img src=x onerror=alert(1)>");
  });

  it("works without a category column", () => {
    expect(ok("Date,Description,Amount\n2026-07-01,Rent,-10\n").value[0]).not.toHaveProperty(
      "csvCategory",
    );
  });
});

describe("debit and credit file", () => {
  it("imports debits as money out and credits as money in, and maps bank-style headers", () => {
    const { value } = ok(debitCredit);
    expect(value.map((t) => [t.date, t.description, t.amountCents])).toEqual([
      ["2026-07-01", "Maple Court Properties rent", -240_000],
      ["2026-07-03", "Cloudbench hosting", -14_900],
      ["2026-07-10", "Paperbird refund", 3400],
      ["2026-07-12", "Hollow Creek Power & Water", -20_150],
      ["2026-07-14", "Zeta Widgets Ltd", -3620],
    ]);
  });

  it("a row with both columns nets them", () => {
    expect(ok(`${DC}2026-07-01,Mixed,10.00,4.00\n`).value[0].amountCents).toBe(-600);
  });

  it("works with only a debit column", () => {
    expect(ok("Date,Description,Debit\n2026-07-01,Rent,5.00\n").value[0].amountCents).toBe(-500);
  });

  it.each([
    [`${DC}2026-07-01,Nothing,,\n`, "debit", /debit or a credit/],
    [`${DC}2026-07-01,Zero,0.00,\n`, "debit", /zero/],
    [`${DC}2026-07-01,Zero net,5.00,5.00\n`, "debit", /zero/],
    [`${DC}2026-07-01,Bad,abc,\n`, "debit", /Invalid amount/],
    [`${DC}2026-07-01,Negative,-5.00,\n`, "debit", /without a minus sign/],
    [`${DC}2026-07-01,Negative,,-5.00\n`, "credit", /without a minus sign/],
  ])("rejects %j", (text, column, message) => {
    const errors = errorsOf(text);
    expect(errors[0].column).toBeDefined();
    expect(errors.map((e) => e.message).join(" ")).toMatch(message);
    expect(errors[0]).toMatchObject({ line: 2, column });
  });

  it("uses the signed Amount column when a file has both kinds of column", () => {
    const text = "Date,Description,Amount,Debit,Credit\n2026-07-01,X,-7.00,99.00,99.00\n";
    expect(ok(text).value[0].amountCents).toBe(-700);
  });
});

describe("errors", () => {
  it("reports line, column, and message for each bad row, with no partial dataset", () => {
    const errors = errorsOf(malformed);
    expect(errors.map((e) => [e.line, e.column])).toEqual([
      [3, "date"],
      [4, "description"],
      [5, "amount"],
      [6, "amount"],
      [7, "date"],
    ]);
    expect(errors[2].message).toMatch(/zero/);
    expect(errors[4].message).toBe("Date is missing.");
    expect(errors.every((e) => e.message.length > 0)).toBe(true);
  });

  it("reports several problems on one row separately", () => {
    const errors = errorsOf(`${SIGNED},,,Food\n`);
    expect(errors.map((e) => e.column)).toEqual(["description", "date", "amount"]);
  });

  it("asks for an amount column, listing accepted headers", () => {
    const errors = errorsOf("Date,Description\n2026-07-01,Rent\n");
    expect(errors[0]).toMatchObject({ line: 1, column: "amount" });
    expect(errors[0].message).toContain("money out");
    expect(errors[0].message).toContain("signed amount or debit and credit columns");
  });

  it("asks for required columns, listing accepted headers", () => {
    const errors = errorsOf("Description,Amount\nRent,-1\n");
    expect(errors[0]).toMatchObject({ line: 1, column: "date" });
    expect(errors[0].message).toContain("transaction date");
  });

  it.each(["", SIGNED])("fails an empty or header-only file %j", (text) => {
    expect(errorsOf(text).length).toBeGreaterThan(0);
  });

  it("passes header warnings through when several columns match", () => {
    const r = ok("Date,Description,Amount,Amt\n2026-07-01,Rent,-5,-6\n");
    expect(r.warnings).toHaveLength(1);
    expect(r.value[0].amountCents).toBe(-500);
  });
});
