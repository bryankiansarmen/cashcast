import { describe, expect, it } from "vitest";
import { mapHeaders, normalizeHeader, type FieldSpec } from "../../src/importers/headers";

const fields: Record<"customer" | "invoice" | "dueDate" | "open" | "memo", FieldSpec> = {
  customer: { required: true, aliases: ["customer", "customer name", "name"] },
  invoice: { required: false, aliases: ["num", "invoice number", "invoice #", "invoice"] },
  dueDate: { required: true, aliases: ["due date", "duedate", "due"] },
  open: { required: true, aliases: ["open balance", "balance", "open amount", "outstanding"] },
  memo: { required: false, aliases: ["memo"] },
};

describe("normalizeHeader", () => {
  it.each([
    ["Due Date", "duedate"],
    ["  Open_Balance ", "openbalance"],
    ["Invoice #", "invoice#"],
    ["Amount ($)", "amount"],
    ["DUE-DATE", "duedate"],
    ["", ""],
  ])("%j becomes %j", (input, expected) => expect(normalizeHeader(input)).toBe(expected));
});

describe("mapHeaders", () => {
  it("maps QuickBooks-style headers", () => {
    const r = mapHeaders(["Customer", "Num", "Due Date", "Open Balance"], fields);
    expect(r).toEqual({
      ok: true,
      value: { customer: 0, invoice: 1, dueDate: 2, open: 3, memo: undefined },
      warnings: [],
    });
  });

  it("is case, spacing, and punctuation insensitive and order independent", () => {
    const r = mapHeaders(["OUTSTANDING", "due_date", "Invoice #", "Customer Name"], fields);
    expect(r.ok && r.value).toEqual({
      customer: 3,
      invoice: 2,
      dueDate: 1,
      open: 0,
      memo: undefined,
    });
  });

  it("lists accepted aliases when a required column is missing", () => {
    const r = mapHeaders(["Customer", "Num", "Open Balance"], fields);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ line: 1, column: "dueDate" });
    expect(r.errors[0].message).toContain("due date, duedate, due");
  });

  it("reports every missing required column", () => {
    const r = mapHeaders(["Num"], fields);
    expect(r.ok === false && r.errors.map((e) => e.column)).toEqual([
      "customer",
      "dueDate",
      "open",
    ]);
  });

  it("chooses by alias order, not column order, and warns", () => {
    const r = mapHeaders(["Balance", "Customer", "Due Date", "Open Balance"], fields);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.open).toBe(3); // "open balance" outranks "balance"
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].message).toContain('using "Open Balance" and ignoring "Balance"');
  });

  it("picks the leftmost of identical headers and warns", () => {
    const r = mapHeaders(["Customer", "Due Date", "Balance", "balance"], fields);
    expect(r.ok && r.value.open).toBe(2);
    expect(r.ok && r.warnings).toHaveLength(1);
  });

  it("leaves unknown columns alone and optional fields undefined", () => {
    const r = mapHeaders(["Customer", "Due Date", "Balance", "Terms"], fields);
    expect(r.ok && r.value.invoice).toBeUndefined();
    expect(r.ok && r.warnings).toEqual([]);
  });
});
