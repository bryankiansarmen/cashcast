import { describe, expect, it } from "vitest";
import {
  initialState,
  MAX_UPLOAD_BYTES,
  oversizeMessage,
  reducer,
  type State,
} from "../../src/state/store";
import credits from "../fixtures/ar-with-credits.csv?raw";
import malformed from "../fixtures/ar-malformed.csv?raw";
import quickbooks from "../fixtures/ar-quickbooks-style.csv?raw";
import history from "../fixtures/history-sample.csv?raw";

const importAr = (state: State, text: string, asOf = "2026-10-12") =>
  reducer(state, { type: "importArAging", text, fileName: "ar.csv", asOf });

describe("initial state", () => {
  it("is the sample dataset with its fixed as-of date and default assumptions", () => {
    const s = initialState();
    expect(s.invoices).toHaveLength(60);
    expect(s.asOf).toBe("2026-09-30");
    expect(s.source).toBe("sample");
    expect(s.scenario).toBe("expected");
    expect(s.history).toEqual([]);
    expect(s.report).toBeNull();
    expect(s.assumptions.customers).toEqual({});
  });
});

describe("importing AR aging", () => {
  it("replaces the dataset, sets the as-of date and source, and reports the count", () => {
    const s = importAr(initialState(), quickbooks);
    expect(s.invoices).toHaveLength(5);
    expect(s.asOf).toBe("2026-10-12");
    expect(s.source).toBe("import");
    expect(s.report).toMatchObject({
      kind: "ar",
      fileName: "ar.csv",
      ok: true,
      count: 5,
      errors: [],
    });
  });

  it("keeps warnings from a successful import", () => {
    const s = importAr(initialState(), credits);
    expect(s.report?.ok).toBe(true);
    expect(s.report?.warnings[0].message).toMatch(/Excluded 2 credit lines/);
  });

  it("a failed import keeps the previous dataset and records line, column, and message (INV-11)", () => {
    const before = importAr(initialState(), quickbooks);
    const after = importAr(before, malformed, "2027-01-01");
    expect(after.invoices).toBe(before.invoices);
    expect(after.asOf).toBe(before.asOf);
    expect(after.source).toBe("import");
    expect(after.report?.ok).toBe(false);
    expect(after.report?.errors[0]).toMatchObject({ line: 3, column: "customer" });
    expect(after.report?.errors.every((e) => e.message)).toBe(true);
  });

  it("a failed import over the sample leaves the sample in place", () => {
    const s = importAr(initialState(), "");
    expect(s.invoices).toHaveLength(60);
    expect(s.source).toBe("sample");
    expect(s.asOf).toBe("2026-09-30");
  });

  it("a later success replaces an earlier error report", () => {
    const failed = importAr(initialState(), malformed);
    expect(importAr(failed, quickbooks).report?.ok).toBe(true);
  });
});

describe("importing payment history", () => {
  it("stores the history and leaves AR data and as-of alone", () => {
    const base = initialState();
    const s = reducer(base, { type: "importHistory", text: history, fileName: "h.csv" });
    expect(s.history).toHaveLength(59);
    expect(s.invoices).toBe(base.invoices);
    expect(s.asOf).toBe(base.asOf);
    expect(s.report).toMatchObject({ kind: "history", ok: true, count: 59 });
  });

  it("a failed history import keeps the previous history", () => {
    const withHistory = reducer(initialState(), {
      type: "importHistory",
      text: history,
      fileName: "h.csv",
    });
    const s = reducer(withHistory, {
      type: "importHistory",
      text: "Customer,Due Date\nA,2026-01-01\n",
      fileName: "bad.csv",
    });
    expect(s.history).toBe(withHistory.history);
    expect(s.report).toMatchObject({ kind: "history", ok: false });
  });
});

describe("rejected uploads", () => {
  it("records the oversize message from the importer limit without touching data", () => {
    const base = initialState();
    const s = reducer(base, {
      type: "importRejected",
      kind: "ar",
      fileName: "huge.csv",
      message: oversizeMessage,
    });
    expect(s.invoices).toBe(base.invoices);
    expect(s.report).toMatchObject({
      ok: false,
      fileName: "huge.csv",
      errors: [{ message: "File is larger than 5 MB." }],
    });
    expect(MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe("other actions", () => {
  it("setAsOf and selectScenario change only their field", () => {
    const base = initialState();
    expect(reducer(base, { type: "setAsOf", asOf: "2026-11-01" })).toEqual({
      ...base,
      asOf: "2026-11-01",
    });
    expect(reducer(base, { type: "selectScenario", scenario: "worst" })).toEqual({
      ...base,
      scenario: "worst",
    });
  });

  it.each(["", "2026-02-30", "not a date", "275760-09-13", "9/30/2026"])(
    "setAsOf ignores %j",
    (bad) => {
      const base = initialState();
      expect(reducer(base, { type: "setAsOf", asOf: bad })).toBe(base);
    },
  );

  it("loadSample restores the sample after an import", () => {
    const imported = importAr(initialState(), quickbooks);
    const s = reducer(imported, { type: "loadSample" });
    expect(s.invoices).toEqual(initialState().invoices);
    expect(s.asOf).toBe("2026-09-30");
    expect(s.source).toBe("sample");
    expect(s.report).toBeNull();
  });

  it("resetAll returns to the initial state", () => {
    const dirty = reducer(importAr(initialState(), quickbooks), {
      type: "selectScenario",
      scenario: "best",
    });
    expect(reducer(dirty, { type: "resetAll" })).toEqual(initialState());
  });

  it("never mutates the previous state", () => {
    const base = initialState();
    const snapshot = structuredClone(base);
    importAr(base, quickbooks);
    reducer(base, { type: "importHistory", text: history, fileName: "h.csv" });
    expect(base).toEqual(snapshot);
  });
});
