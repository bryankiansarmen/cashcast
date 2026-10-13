import { describe, expect, it } from "vitest";
import { categorize, validateRule } from "../../src/budget/categorize";
import { MAX_CATEGORY_LENGTH, UNCATEGORIZED, type CategoryRule } from "../../src/budget/types";

const rule = (id: string, contains: string, category: string): CategoryRule => ({
  id,
  contains,
  category,
});
const rules = [
  rule("r1", "starbucks", "Coffee"),
  rule("r2", "coffee", "Meals"),
  rule("r3", "uber", "Travel"),
];
const tx = (description: string, csvCategory?: string) => ({ description, csvCategory });

describe("categorize", () => {
  it("a CSV category beats a matching rule", () => {
    expect(categorize(tx("STARBUCKS #123", "Team treats"), rules)).toBe("Team treats");
  });

  it.each([undefined, "", "   ", "\t"])("a blank CSV category (%j) falls to the rules", (blank) => {
    expect(categorize(tx("Starbucks #123", blank), rules)).toBe("Coffee");
  });

  it("the first matching rule in list order wins, not the most specific", () => {
    expect(categorize(tx("Starbucks coffee run"), rules)).toBe("Coffee");
    const reordered = [rules[1], rules[0], rules[2]];
    expect(categorize(tx("Starbucks coffee run"), reordered)).toBe("Meals");
  });

  it.each([
    ["STARBUCKS STORE 4", "Coffee"],
    ["starbucks", "Coffee"],
    ["Visit to StArBuCkS today", "Coffee"],
    ["UBER *TRIP", "Travel"],
    ["cuber rental", "Travel"], // substring, not whole-word
  ])("matches %j case-insensitively as a substring", (description, category) => {
    expect(categorize(tx(description), rules)).toBe(category);
  });

  it("falls back to Uncategorized when nothing matches", () => {
    expect(categorize(tx("Office rent"), rules)).toBe(UNCATEGORIZED);
    expect(UNCATEGORIZED).toBe("Uncategorized");
  });

  it("handles no rules and an empty description", () => {
    expect(categorize(tx("Anything"), [])).toBe(UNCATEGORIZED);
    expect(categorize(tx(""), rules)).toBe(UNCATEGORIZED);
  });

  it("ignores a rule with empty match text instead of matching everything", () => {
    expect(
      categorize(tx("Office rent"), [
        rule("bad", "", "Everything"),
        rule("bad2", "   ", "Everything"),
      ]),
    ).toBe(UNCATEGORIZED);
    expect(categorize(tx("Uber"), [rule("bad", "", "Everything"), rules[2]])).toBe("Travel");
  });

  it("trims the category it returns", () => {
    expect(categorize(tx("Uber", "  Travel  "), [])).toBe("Travel");
    expect(categorize(tx("Uber"), [rule("r", "uber", "  Rides  ")])).toBe("Rides");
  });

  it("does not mutate the rules and gives the same answer every time", () => {
    const snapshot = structuredClone(rules);
    const first = categorize(tx("Starbucks"), rules);
    expect(categorize(tx("Starbucks"), rules)).toBe(first);
    expect(rules).toEqual(snapshot);
  });
});

describe("validateRule", () => {
  it("accepts a normal rule and a category of exactly 40 characters", () => {
    expect(validateRule({ contains: "uber", category: "Travel" })).toEqual([]);
    expect(validateRule({ contains: "uber", category: "x".repeat(MAX_CATEGORY_LENGTH) })).toEqual(
      [],
    );
  });

  it.each(["", "   ", "\t\n"])(
    "rejects empty match text %j with a readable message",
    (contains) => {
      expect(validateRule({ contains, category: "Travel" })).toEqual([
        "Enter the text to look for in the description.",
      ]);
    },
  );

  it.each(["", "  "])("rejects an empty category %j", (category) => {
    expect(validateRule({ contains: "uber", category })).toEqual(["Enter a category."]);
  });

  it("rejects a category over 40 characters and says how long it is", () => {
    expect(validateRule({ contains: "uber", category: "x".repeat(41) })).toEqual([
      "Category names can be at most 40 characters (this one is 41).",
    ]);
  });

  it("counts the length after trimming", () => {
    expect(validateRule({ contains: "uber", category: `  ${"x".repeat(40)}  ` })).toEqual([]);
  });

  it("reports every problem at once", () => {
    expect(validateRule({ contains: "", category: "" })).toHaveLength(2);
  });
});
