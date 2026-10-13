import { categorize } from "./categorize";
import { UNCATEGORIZED, type Budget, type CategoryRule, type Transaction } from "./types";

export type BudgetStatus = "unbudgeted" | "over" | "near" | "on_track";

export interface CategoryVariance {
  category: string;
  month: string; // YYYY-MM
  budgetCents: number;
  spendCents: number; // negative of the month's net amounts, so refunds reduce it
  varianceCents: number; // spend minus budget; positive means over budget
  variancePct: number | null; // variance / budget, or null when there is no budget
  status: BudgetStatus;
  /** The 3 largest outflows in this category and month. */
  topContributors: Transaction[];
}

export const monthKey = (date: string): string => date.slice(0, 7);

/** Unbudgeted when budget is 0 and spend is above 0; over beyond the budget; near from 90%; otherwise on track. */
export function budgetStatus(spendCents: number, budgetCents: number): BudgetStatus {
  if (budgetCents === 0 && spendCents > 0) return "unbudgeted";
  if (spendCents > budgetCents) return "over";
  if (spendCents * 10 >= budgetCents * 9 && budgetCents > 0) return "near"; // integer test for spend >= 90% of budget
  return "on_track";
}

/**
 * One row per category for the month: every category with transactions or a budget, plus Uncategorized.
 * Rows are ordered by spend, largest first, then by name.
 */
export function varianceReport(
  transactions: readonly Transaction[],
  rules: readonly CategoryRule[],
  budget: Budget,
  month: string,
): CategoryVariance[] {
  const byCategory = new Map<string, Transaction[]>();
  for (const category of [UNCATEGORIZED, ...Object.keys(budget.monthlyCents)])
    byCategory.set(category, []);
  for (const tx of transactions) {
    if (monthKey(tx.date) !== month) continue;
    const category = categorize(tx, rules);
    byCategory.set(category, [...(byCategory.get(category) ?? []), tx]);
  }
  return [...byCategory]
    .map(([category, txs]) => {
      const budgetCents = budget.monthlyCents[category] ?? 0;
      const spendCents = 0 - txs.reduce((sum, t) => sum + t.amountCents, 0); // not -sum, which would give -0
      const varianceCents = spendCents - budgetCents;
      return {
        category,
        month,
        budgetCents,
        spendCents,
        varianceCents,
        variancePct: budgetCents > 0 ? varianceCents / budgetCents : null,
        status: budgetStatus(spendCents, budgetCents),
        topContributors: topContributors(txs),
      };
    })
    .sort((a, b) => b.spendCents - a.spendCents || a.category.localeCompare(b.category));
}

/** Largest outflows by absolute amount; ties go to the earlier date, then to input order. */
function topContributors(txs: readonly Transaction[]): Transaction[] {
  return txs
    .map((tx, index) => ({ tx, index }))
    .filter(({ tx }) => tx.amountCents < 0)
    .sort(
      (a, b) =>
        a.tx.amountCents - b.tx.amountCents ||
        a.tx.date.localeCompare(b.tx.date) ||
        a.index - b.index,
    )
    .slice(0, 3)
    .map(({ tx }) => tx);
}
