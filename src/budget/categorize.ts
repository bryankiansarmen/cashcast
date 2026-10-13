import { MAX_CATEGORY_LENGTH, UNCATEGORIZED, type CategoryRule, type Transaction } from "./types";

/**
 * The CSV category if it is not blank, else the first rule (in list order) whose text is contained in the
 * description (case-insensitive), else Uncategorized.
 */
export function categorize(
  tx: Pick<Transaction, "description" | "csvCategory">,
  rules: readonly CategoryRule[],
): string {
  const csv = tx.csvCategory?.trim();
  if (csv) return csv;
  const description = tx.description.toLowerCase();
  // A rule with empty match text would match every transaction, so it never applies.
  const rule = rules.find(
    (r) => r.contains.trim() !== "" && description.includes(r.contains.toLowerCase()),
  );
  return rule ? rule.category.trim() : UNCATEGORIZED;
}

/** Readable messages for a rule that cannot be saved; empty means valid. */
export function validateRule(rule: Pick<CategoryRule, "contains" | "category">): string[] {
  const errors: string[] = [];
  if (rule.contains.trim() === "") errors.push("Enter the text to look for in the description.");
  const category = rule.category.trim();
  if (category === "") errors.push("Enter a category.");
  else if (category.length > MAX_CATEGORY_LENGTH) {
    errors.push(
      `Category names can be at most ${MAX_CATEGORY_LENGTH} characters (this one is ${category.length}).`,
    );
  }
  return errors;
}
