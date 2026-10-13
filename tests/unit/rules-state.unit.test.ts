import { describe, expect, it } from "vitest";
import { categorize } from "../../src/budget/categorize";
import { generateTransactionSample, SAMPLE_RULES } from "../../src/sample/budget-sample";
import { initialState, reducer, type Action, type State } from "../../src/state/store";

const run = (state: State, ...actions: Action[]) => actions.reduce(reducer, state);
const base = initialState();
const withRules = (rules: { id: string; contains: string; category: string }[]): State => ({
  ...base,
  rules,
});
const ids = (s: State) => s.rules.map((r) => r.id);

describe("addRule", () => {
  it("appends a rule with a fresh id and trims what was typed", () => {
    const s = reducer(base, { type: "addRule", contains: "  zeta  ", category: " Supplies " });
    expect(s.rules).toHaveLength(base.rules.length + 1);
    expect(s.rules.at(-1)).toEqual({ id: "rule-15", contains: "zeta", category: "Supplies" });
    expect(s.ruleErrors).toEqual({});
  });

  it("never reuses an id, even after deleting one", () => {
    const s = run(
      base,
      { type: "deleteRule", id: "rule-3" },
      { type: "addRule", contains: "a", category: "B" },
    );
    expect(s.rules.at(-1)!.id).toBe("rule-15");
    expect(new Set(ids(s)).size).toBe(ids(s).length);
  });

  it("starts at rule-1 when there are no rules, and ignores ids it does not recognise", () => {
    expect(
      reducer(withRules([]), { type: "addRule", contains: "a", category: "B" }).rules[0].id,
    ).toBe("rule-1");
    expect(
      reducer(withRules([{ id: "custom", contains: "x", category: "Y" }]), {
        type: "addRule",
        contains: "a",
        category: "B",
      }).rules[1].id,
    ).toBe("rule-1");
  });

  it.each([
    ["", "Travel", /text to look for/],
    ["   ", "Travel", /text to look for/],
    ["uber", "", /Enter a category/],
    ["uber", "x".repeat(41), /at most 40 characters/],
  ])("blocks %j / %j with a message and adds nothing", (contains, category, message) => {
    const s = reducer(base, { type: "addRule", contains, category });
    expect(s.rules).toBe(base.rules);
    expect(s.ruleErrors.new).toMatch(message);
  });

  it("clears the earlier message once a valid rule is added", () => {
    const s = run(
      base,
      { type: "addRule", contains: "", category: "x" },
      { type: "addRule", contains: "uber", category: "Travel" },
    );
    expect(s.ruleErrors).toEqual({});
  });
});

describe("updateRule", () => {
  it("applies a valid edit to the right rule and trims it", () => {
    const s = reducer(base, {
      type: "updateRule",
      id: "rule-1",
      field: "category",
      text: "  Cloud  ",
    });
    expect(s.rules[0]).toEqual({ id: "rule-1", contains: "cloudbench", category: "Cloud" });
    expect(s.rules[1]).toBe(base.rules[1]);
  });

  it.each([
    ["contains", "", /text to look for/],
    ["contains", "   ", /text to look for/],
    ["category", "", /Enter a category/],
    ["category", "y".repeat(41), /at most 40 characters/],
  ] as const)(
    "blocks %s = %j with a message tied to that field and keeps the rule",
    (field, text, message) => {
      const s = reducer(base, { type: "updateRule", id: "rule-1", field, text });
      expect(s.rules).toBe(base.rules);
      expect(s.ruleErrors[`rule.rule-1.${field}`]).toMatch(message);
    },
  );

  it("accepts a category of exactly 40 characters", () => {
    expect(
      reducer(base, { type: "updateRule", id: "rule-1", field: "category", text: "z".repeat(40) })
        .ruleErrors,
    ).toEqual({});
  });

  it("clears the message after a later valid edit of the same field", () => {
    const s = run(
      base,
      { type: "updateRule", id: "rule-1", field: "contains", text: "" },
      { type: "updateRule", id: "rule-1", field: "contains", text: "hosting" },
    );
    expect(s.ruleErrors).toEqual({});
    expect(s.rules[0].contains).toBe("hosting");
  });

  it("ignores an unknown rule id", () => {
    expect(reducer(base, { type: "updateRule", id: "nope", field: "contains", text: "x" })).toBe(
      base,
    );
  });
});

describe("moveRule and deleteRule", () => {
  it("moves a rule up and down by swapping with its neighbour", () => {
    const up = reducer(base, { type: "moveRule", id: "rule-3", direction: "up" });
    expect(ids(up).slice(0, 3)).toEqual(["rule-1", "rule-3", "rule-2"]);
    const down = reducer(base, { type: "moveRule", id: "rule-1", direction: "down" });
    expect(ids(down).slice(0, 2)).toEqual(["rule-2", "rule-1"]);
  });

  it("does nothing at the ends or for an unknown id", () => {
    expect(reducer(base, { type: "moveRule", id: "rule-1", direction: "up" })).toBe(base);
    expect(reducer(base, { type: "moveRule", id: "rule-14", direction: "down" })).toBe(base);
    expect(reducer(base, { type: "moveRule", id: "nope", direction: "up" })).toBe(base);
  });

  it("deletes a rule and its pending messages only", () => {
    const withErrors = run(
      base,
      { type: "updateRule", id: "rule-2", field: "contains", text: "" },
      { type: "updateRule", id: "rule-5", field: "contains", text: "" },
    );
    const s = reducer(withErrors, { type: "deleteRule", id: "rule-2" });
    expect(ids(s)).not.toContain("rule-2");
    expect(Object.keys(s.ruleErrors)).toEqual(["rule.rule-5.contains"]);
  });
});

describe("rule order changes which rule wins", () => {
  const tx = { description: "Starbucks coffee run", csvCategory: undefined };
  const rules = [
    { id: "rule-1", contains: "coffee", category: "Meals" },
    { id: "rule-2", contains: "starbucks", category: "Coffee shops" },
  ];

  it("the first matching rule decides, and moving a rule up changes the outcome", () => {
    const s = withRules(rules);
    expect(categorize(tx, s.rules)).toBe("Meals");
    const swapped = reducer(s, { type: "moveRule", id: "rule-2", direction: "up" });
    expect(categorize(tx, swapped.rules)).toBe("Coffee shops");
  });

  it("deleting the winning rule hands the transaction to the next match", () => {
    const s = reducer(withRules(rules), { type: "deleteRule", id: "rule-1" });
    expect(categorize(tx, s.rules)).toBe("Coffee shops");
  });
});

describe("creating a rule moves matching transactions out of Uncategorized", () => {
  const uncategorized = (s: State) =>
    s.transactions.filter((t) => categorize(t, s.rules) === "Uncategorized");

  it("every transaction the new rule matches leaves the queue at once, the rest stay", () => {
    const before = uncategorized(base);
    expect(before.length).toBeGreaterThan(3);
    const zeta = before.filter((t) => t.description.toLowerCase().includes("zeta widgets"));
    expect(zeta.length).toBeGreaterThan(0);
    const s = reducer(base, { type: "addRule", contains: "Zeta Widgets", category: "Supplies" });
    const after = uncategorized(s);
    expect(after).toHaveLength(before.length - zeta.length);
    expect(zeta.every((t) => categorize(t, s.rules) === "Supplies")).toBe(true);
    expect(generateTransactionSample()).toEqual(base.transactions); // the data itself is untouched
  });

  it("loadBudgetSample restores the sample rules and clears rule messages", () => {
    const dirty = run(
      base,
      { type: "addRule", contains: "", category: "" },
      { type: "deleteRule", id: "rule-1" },
    );
    const s = reducer(dirty, { type: "loadBudgetSample" });
    expect(s.rules).toEqual(SAMPLE_RULES);
    expect(s.ruleErrors).toEqual({});
  });

  it("does not mutate the previous state", () => {
    const snapshot = structuredClone(base);
    run(
      base,
      { type: "addRule", contains: "a", category: "B" },
      { type: "moveRule", id: "rule-2", direction: "down" },
      { type: "deleteRule", id: "rule-9" },
      { type: "updateRule", id: "rule-1", field: "contains", text: "" },
    );
    expect(base).toEqual(snapshot);
  });
});
