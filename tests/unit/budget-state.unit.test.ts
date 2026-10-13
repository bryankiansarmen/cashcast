import { describe, expect, it } from "vitest";
import { SAMPLE_BUDGET, SAMPLE_RULES } from "../../src/sample/budget-sample";
import {
  initialState,
  oversizeMessage,
  reducer,
  type Action,
  type State,
} from "../../src/state/store";
import credits from "../fixtures/ar-with-credits.csv?raw";
import debitCredit from "../fixtures/transactions-debit-credit.csv?raw";
import malformed from "../fixtures/transactions-malformed.csv?raw";
import sampleCsv from "../fixtures/transactions-sample.csv?raw";

const run = (state: State, ...actions: Action[]) => actions.reduce(reducer, state);
const base = initialState();
const target = (state: State, category: string, text: string) =>
  reducer(state, { type: "setBudgetTarget", category, text });

describe("initial budget state", () => {
  it("loads the sample transactions, rules, and targets, showing the latest month", () => {
    expect(base.transactions).toHaveLength(61);
    expect(base.rules).toBe(SAMPLE_RULES);
    expect(base.budget).toEqual(SAMPLE_BUDGET);
    expect(base.month).toBe("2026-09");
    expect(base.txSource).toBe("sample");
    expect(base.budgetReport).toBeNull();
    expect(base.budgetErrors).toEqual({});
  });

  it("does not share the targets object with the sample constant", () => {
    const edited = target(base, "Rent", "1");
    expect(SAMPLE_BUDGET.monthlyCents.Rent).toBe(240_000);
    expect(edited.budget.monthlyCents.Rent).toBe(100);
  });
});

describe("setBudgetTarget: dollars become whole cents", () => {
  it.each([
    ["250", 25_000],
    ["250.55", 25_055],
    ["250.5", 25_050],
    ["$2,400", 240_000],
    ["0.1", 10],
    ["0.07", 7],
    ["19.99", 1999],
    ["0", 0],
    ["  75  ", 7500],
  ])("%j is stored as %d cents", (text, cents) => {
    const s = target(base, "Travel", text);
    expect(s.budget.monthlyCents.Travel).toBe(cents);
    expect(Number.isInteger(s.budget.monthlyCents.Travel)).toBe(true);
    expect(s.budgetErrors).toEqual({});
  });

  it("a blank target clears it", () => {
    const s = target(base, "Travel", "   ");
    expect("Travel" in s.budget.monthlyCents).toBe(false);
    expect(s.budget.monthlyCents.Rent).toBe(240_000);
  });

  it("can set a target on a new category", () => {
    expect(target(base, "Staff welfare", "150").budget.monthlyCents["Staff welfare"]).toBe(15_000);
  });

  it.each([
    ["abc", /Enter an amount in dollars/],
    ["1e3", /Enter an amount in dollars/],
    ["12.345", /Enter an amount in dollars/],
    ["", null],
    ["-5", /cannot be negative/],
    ["(5.00)", /cannot be negative/],
  ])("rejects %j without changing the budget", (text, message) => {
    const s = target(base, "Travel", text);
    if (message === null) return; // a blank is a valid clear, covered above
    expect(s.budget).toBe(base.budget);
    expect(s.budgetErrors["target.Travel"]).toMatch(message);
  });

  it("clears the message when a later edit is valid", () => {
    const s = run(
      base,
      { type: "setBudgetTarget", category: "Travel", text: "x" },
      { type: "setBudgetTarget", category: "Travel", text: "80" },
    );
    expect(s.budgetErrors).toEqual({});
    expect(s.budget.monthlyCents.Travel).toBe(8000);
  });

  it("keeps messages for different categories independent", () => {
    const s = run(
      base,
      { type: "setBudgetTarget", category: "Travel", text: "x" },
      { type: "setBudgetTarget", category: "Meals", text: "60" },
    );
    expect(Object.keys(s.budgetErrors)).toEqual(["target.Travel"]);
  });

  it("resetBudgetTargets restores the sample targets and clears messages", () => {
    const dirty = run(
      base,
      { type: "setBudgetTarget", category: "Rent", text: "1" },
      { type: "setBudgetTarget", category: "Travel", text: "x" },
    );
    const s = reducer(dirty, { type: "resetBudgetTargets" });
    expect(s.budget).toEqual(SAMPLE_BUDGET);
    expect(s.budgetErrors).toEqual({});
  });
});

describe("importing transactions", () => {
  const imp = (state: State, text: string, fileName = "t.csv") =>
    reducer(state, { type: "importTransactions", text, fileName });

  it("replaces the transactions, shows the latest month, and records the count", () => {
    const s = imp(base, debitCredit);
    expect(s.transactions).toHaveLength(5);
    expect(s.month).toBe("2026-07");
    expect(s.txSource).toBe("import");
    expect(s.budgetReport).toMatchObject({
      kind: "transactions",
      ok: true,
      count: 5,
      fileName: "t.csv",
    });
    expect(s.report).toBeNull();
  });

  it("keeps the targets and rules when transactions are replaced", () => {
    const s = imp(target(base, "Rent", "999"), sampleCsv);
    expect(s.budget.monthlyCents.Rent).toBe(99_900);
    expect(s.rules).toBe(base.rules);
    expect(s.transactions).toHaveLength(61);
  });

  it("a failed import keeps the previous transactions and records line, column, and message (INV-11)", () => {
    const s = imp(base, malformed, "bad.csv");
    expect(s.transactions).toBe(base.transactions);
    expect(s.month).toBe(base.month);
    expect(s.txSource).toBe("sample");
    expect(s.budgetReport?.ok).toBe(false);
    expect(s.budgetReport?.errors[0]).toMatchObject({ line: 3, column: "date" });
  });

  it("does not touch the receivables report, and the receivables import does not touch the budget report", () => {
    const withBudget = imp(base, debitCredit);
    const afterAr = reducer(withBudget, {
      type: "importArAging",
      text: credits,
      fileName: "ar.csv",
      asOf: "2026-10-12",
    });
    expect(afterAr.budgetReport).toBe(withBudget.budgetReport);
    expect(afterAr.report?.kind).toBe("ar");
  });

  it("an oversize transactions file records the size message against the budget report only", () => {
    const s = reducer(base, {
      type: "importRejected",
      kind: "transactions",
      fileName: "huge.csv",
      message: oversizeMessage,
    });
    expect(s.budgetReport).toMatchObject({
      kind: "transactions",
      ok: false,
      errors: [{ message: "File is larger than 5 MB." }],
    });
    expect(s.report).toBeNull();
    expect(s.transactions).toBe(base.transactions);
  });
});

describe("month, sample loading, and resets", () => {
  it("selectMonth accepts a month with data and ignores any other", () => {
    expect(reducer(base, { type: "selectMonth", month: "2026-07" }).month).toBe("2026-07");
    expect(reducer(base, { type: "selectMonth", month: "2025-01" })).toBe(base);
    expect(reducer(base, { type: "selectMonth", month: "nonsense" })).toBe(base);
  });

  it("loadBudgetSample restores sample transactions, rules, and targets only", () => {
    const changed = run(
      base,
      { type: "importTransactions", text: debitCredit, fileName: "t.csv" },
      { type: "setBudgetTarget", category: "Rent", text: "1" },
      { type: "selectScenario", scenario: "worst" },
    );
    const s = reducer(changed, { type: "loadBudgetSample" });
    expect(s.transactions).toEqual(base.transactions);
    expect(s.budget).toEqual(SAMPLE_BUDGET);
    expect(s.month).toBe("2026-09");
    expect(s.txSource).toBe("sample");
    expect(s.budgetReport).toBeNull();
    expect(s.scenario).toBe("worst"); // receivables-side settings stay
  });

  it("loading the receivables sample leaves the budget side alone", () => {
    const edited = run(
      base,
      { type: "setBudgetTarget", category: "Rent", text: "1" },
      { type: "importTransactions", text: debitCredit, fileName: "t.csv" },
      { type: "importArAging", text: credits, fileName: "ar.csv", asOf: "2026-10-12" },
    );
    const s = reducer(edited, { type: "loadSample" });
    expect(s.source).toBe("sample");
    expect(s.invoices).toEqual(base.invoices);
    expect(s.transactions).toBe(edited.transactions);
    expect(s.budget).toBe(edited.budget);
    expect(s.budgetReport).toBe(edited.budgetReport);
    expect(s.report).toBeNull();
  });

  it("resetAll returns everything, budget included, to the initial state", () => {
    const dirty = run(
      base,
      { type: "setBudgetTarget", category: "Rent", text: "1" },
      { type: "importTransactions", text: debitCredit, fileName: "t.csv" },
    );
    expect(reducer(dirty, { type: "resetAll" })).toEqual(initialState());
  });

  it("never mutates the previous state", () => {
    const snapshot = structuredClone(base);
    run(
      base,
      { type: "setBudgetTarget", category: "Rent", text: "1" },
      { type: "setBudgetTarget", category: "Travel", text: "" },
      { type: "importTransactions", text: debitCredit, fileName: "t.csv" },
      { type: "selectMonth", month: "2026-07" },
    );
    expect(base).toEqual(snapshot);
  });
});
