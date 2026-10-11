import { describe, expect, it } from "vitest";
import { importArAging } from "../../src/importers/ar-aging";
import { classify } from "../../src/engine/aging";
import credits from "../fixtures/ar-with-credits.csv?raw";
import malformed from "../fixtures/ar-malformed.csv?raw";
import quickbooks from "../fixtures/ar-quickbooks-style.csv?raw";
import xss from "../fixtures/ar-xss-name.csv?raw";

const asOf = "2026-09-30";
const HEADER = "Customer,Num,Due Date,Open Balance\n";
const ok = (text: string) => {
  const r = importArAging(text, asOf);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r;
};
const errorsOf = (text: string) => {
  const r = importArAging(text, asOf);
  if (r.ok) throw new Error("expected errors");
  return r.errors;
};

describe("importArAging: QuickBooks-style file", () => {
  it("imports invoices with US dates and $ amounts", () => {
    const { value, warnings } = ok(quickbooks);
    expect(value).toHaveLength(5);
    expect(value[0]).toEqual({
      id: "inv-2",
      invoiceNumber: "1001",
      customerKey: "harbor logistics",
      customerName: "Harbor Logistics",
      invoiceDate: "2026-08-15",
      dueDate: "2026-09-14",
      openCents: 1_245_000,
    });
    expect(value.reduce((s, i) => s + i.openCents, 0)).toBe(
      1_245_000 + 320_050 + 890_000 + 2_100_000 + 97_525,
    );
    expect(warnings).toEqual([]);
  });

  it("produces invoices the engine can classify", () => {
    expect(ok(quickbooks).value.map((i) => classify(i, asOf).bucket)).toEqual([
      "d1_30",
      "current",
      "d31_60",
      "current",
      "d91_plus",
    ]);
  });
});

describe("importArAging: row errors", () => {
  it("reports line, column, and message for every bad row, with no partial dataset", () => {
    const errors = errorsOf(malformed);
    expect(errors.map((e) => [e.line, e.column])).toEqual([
      [3, "customer"],
      [4, "dueDate"],
      [5, "dueDate"],
      [6, "open"],
      [7, "open"],
      [8, "open"],
      [9, "dueDate"],
    ]);
    expect(errors.every((e) => e.message.length > 0)).toBe(true);
    expect(errors[1].message).toMatch(/never inferred/);
    expect(errors[3].message).toMatch(/zero/);
  });

  it("reports several problems on one row separately", () => {
    const errors = errorsOf(HEADER + ",1,,abc\n");
    expect(errors.map((e) => e.column)).toEqual(["customer", "dueDate", "open"]);
    expect(errors.every((e) => e.line === 2)).toBe(true);
  });

  it("returns errors for a missing required column, listing accepted headers", () => {
    const errors = errorsOf("Customer,Num,Balance\nAcme,1,100\n");
    expect(errors[0]).toMatchObject({ line: 1, column: "dueDate" });
    expect(errors[0].message).toContain("due date");
  });

  it.each([
    ["an empty file", ""],
    ["a header-only file", HEADER],
  ])("returns errors for %s", (_name, text) => {
    expect(errorsOf(text).length).toBeGreaterThan(0);
  });
});

describe("importArAging: edge cases", () => {
  it("excludes credits with a warning giving count and total", () => {
    const { value, warnings } = ok(credits);
    expect(value.map((i) => i.invoiceNumber)).toEqual(["2001", "2004"]);
    expect(warnings).toEqual([
      {
        message:
          "Excluded 2 credit lines totalling $1,550.50; credits are never netted against invoices.",
      },
    ]);
  });

  it("returns an error when only credits remain", () => {
    expect(errorsOf(HEADER + "Acme,1,2026-10-01,-50.00\n")[0].message).toMatch(/only credits/);
  });

  it("keeps duplicate invoice numbers for one customer as separate lines with a warning", () => {
    const { value, warnings } = ok(
      HEADER + "Acme,7,2026-10-01,10\nacme,7,2026-10-02,20\nBeta,7,2026-10-02,30\n",
    );
    expect(value).toHaveLength(3);
    expect(warnings.map((w) => w.message)).toEqual([
      "1 duplicate invoice number for the same customer; kept as separate lines.",
    ]);
  });

  it("does not treat empty invoice numbers as duplicates", () => {
    expect(ok(HEADER + "Acme,,2026-10-01,10\nAcme,,2026-10-02,20\n").warnings).toEqual([]);
  });

  it("warns, once, about invoice dates after the as-of date", () => {
    const text =
      "Customer,Num,Invoice Date,Due Date,Open Balance\nAcme,1,2026-10-05,2026-11-01,10\nAcme,2,2026-10-06,2026-11-02,10\n";
    const { value, warnings } = ok(text);
    expect(value).toHaveLength(2);
    expect(warnings).toEqual([
      {
        line: 2,
        message: "2 invoices have an invoice date after the as-of date (first at line 2).",
      },
    ]);
  });

  it("ignores an unreadable invoice date with a warning", () => {
    const text = "Customer,Invoice Date,Due Date,Open Balance\nAcme,not a date,2026-11-01,10\n";
    const { value, warnings } = ok(text);
    expect(value[0].invoiceDate).toBeUndefined();
    expect(warnings[0]).toMatchObject({ line: 2, column: "invoiceDate" });
  });

  it("trims and collapses customer names, merging case-insensitively with first-seen casing", () => {
    const { value } = ok(HEADER + "  Acme   Corp ,1,2026-10-01,10\nACME CORP,2,2026-10-02,20\n");
    expect(value.map((i) => i.customerName)).toEqual(["Acme Corp", "Acme Corp"]);
    expect(new Set(value.map((i) => i.customerKey)).size).toBe(1);
  });

  it("accepts ISO and US dates and amount formats", () => {
    const { value } = ok(
      HEADER + 'A,1,2026-10-01,"$1,234.56"\nB,2,10/2/2026,(10.00)\nC,3,10/3/2026,7\n',
    );
    expect(value.map((i) => [i.dueDate, i.openCents])).toEqual([
      ["2026-10-01", 123_456],
      ["2026-10-03", 700],
    ]);
  });

  it("keeps a due date more than 91 days out (the engine treats it as uncollected)", () => {
    expect(ok(HEADER + "A,1,2027-06-01,100\n").value).toHaveLength(1);
  });

  it("generates stable ids from file line numbers", () => {
    expect(ok(HEADER + "A,1,2026-10-01,1\nB,2,2026-10-02,1\n").value.map((i) => i.id)).toEqual([
      "inv-2",
      "inv-3",
    ]);
  });
});

describe("importArAging: untrusted text", () => {
  it("keeps HTML in a customer name as a plain string", () => {
    const { value } = ok(xss);
    expect(value[0].customerName).toBe("<img src=x onerror=alert(1)>");
    expect(value[1].customerName).toBe("<script>alert('x')</script> Co");
  });
});
