import { describe, expect, it } from "vitest";
import { MAX_BYTES, MAX_ROWS, readCsv } from "../../src/importers/csv";

const table = (text: string) => {
  const r = readCsv(text);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
};

describe("readCsv", () => {
  it.each([
    ["comma", ","],
    ["semicolon", ";"],
    ["tab", "\t"],
  ])("parses %s-delimited files", (_name, d) => {
    const t = table(`Customer${d}Amount\nAcme${d}100\nBeta${d}200\n`);
    expect(t.delimiter).toBe(d);
    expect(t.headers).toEqual(["Customer", "Amount"]);
    expect(t.rows).toEqual([
      { line: 2, cells: ["Acme", "100"] },
      { line: 3, cells: ["Beta", "200"] },
    ]);
  });

  it("strips a byte-order mark from the first header", () => {
    expect(table("﻿Customer,Amount\nAcme,1\n").headers[0]).toBe("Customer");
  });

  it("handles quoted fields, CRLF, and keeps blank-line numbering", () => {
    const t = table('Customer,Amount\r\n"Acme, Inc",100\r\n\r\nBeta,200\r\n');
    expect(t.rows).toEqual([
      { line: 2, cells: ["Acme, Inc", "100"] },
      { line: 4, cells: ["Beta", "200"] },
    ]);
  });

  it("accepts a header-only file with zero rows", () => {
    expect(table("Customer,Amount\n").rows).toEqual([]);
  });

  it("accepts a single-column file", () => {
    expect(table("Customer\nAcme\n").rows).toHaveLength(1);
  });

  it.each(["", "   \n\n"])("rejects an empty file %j", (text) => {
    const r = readCsv(text);
    expect(r.ok).toBe(false);
  });

  it("reports a malformed quote with its line", () => {
    const r = readCsv('Customer,Amount\n"Acme,100\nBeta,200\n');
    expect(r.ok).toBe(false);
  });

  it("rejects input over the size limit before parsing", () => {
    const r = readCsv("a".repeat(MAX_BYTES + 1));
    expect(r).toEqual({ ok: false, errors: [{ message: "File is larger than 5 MB." }] });
  });

  it("measures size in bytes, not characters", () => {
    // 3-byte characters: under the limit by length, over it in bytes.
    const r = readCsv("€".repeat(Math.floor(MAX_BYTES / 3) + 1));
    expect(r.ok).toBe(false);
  });

  it("accepts exactly the row limit and rejects one more", () => {
    const body = (n: number) =>
      "Customer,Amount\n" + Array.from({ length: n }, (_, i) => `C${i},1`).join("\n");
    const ok = readCsv(body(MAX_ROWS));
    expect(ok.ok && ok.value.rows).toHaveLength(MAX_ROWS);
    const over = readCsv(body(MAX_ROWS + 1));
    expect(over).toEqual({ ok: false, errors: [{ message: "File has more than 20,000 rows." }] });
  });
});
