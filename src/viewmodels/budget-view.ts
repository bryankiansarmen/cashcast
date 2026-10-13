import { monthsOf, varianceReport, type BudgetStatus } from "../budget";
import type { Budget, CategoryRule, Transaction } from "../budget/types";
import { dollarsInputText } from "./format";

/** Kinds of figure the budget page displays; the explain registry must have an entry for each (INV-07). */
export const BUDGET_EXPLAIN_IDS = [
  "budget.totalSpend",
  "budget.totalBudget",
  "budget.variance",
  "budget.categoriesOver",
  "budget.unbudgetedSpend",
  "budget.target",
  "budget.categorySpend",
  "budget.categoryVariance",
  "budget.categoryStatus",
  "budget.contributors",
] as const;

/** Text and an icon, so a status never rests on colour alone. */
export const STATUS_DISPLAY: Record<BudgetStatus, { label: string; icon: string }> = {
  on_track: { label: "On track", icon: "✓" },
  near: { label: "Near budget", icon: "!" },
  over: { label: "Over budget", icon: "▲" },
  unbudgeted: { label: "Unbudgeted", icon: "?" },
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
/** "2026-09" gives "September 2026". */
export const monthLabel = (month: string): string =>
  `${MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? month} ${month.slice(0, 4)}`;

export interface BudgetRow {
  category: string;
  /** What the target input shows, in dollars; empty when there is no target. */
  targetText: string;
  hasTarget: boolean;
  budgetCents: number;
  spendCents: number;
  varianceCents: number;
  variancePct: number | null;
  status: BudgetStatus;
  statusLabel: string;
  statusIcon: string;
  topContributors: { id: string; date: string; description: string; amountCents: number }[];
}

export interface BudgetView {
  isEmpty: boolean;
  month: string;
  monthLabel: string;
  months: { value: string; label: string }[];
  rows: BudgetRow[];
  totals: {
    spendCents: number;
    budgetCents: number; // sum of the targets you set
    varianceCents: number; // total spend minus total budget
    categoriesOver: number;
    unbudgetedSpendCents: number;
  };
}

/** Display structure for the Budget page. Figures stay unrounded integers; the UI formats them. */
export function buildBudgetView(
  transactions: readonly Transaction[],
  rules: readonly CategoryRule[],
  budget: Budget,
  month: string,
): BudgetView {
  const rows: BudgetRow[] = varianceReport(transactions, rules, budget, month).map((r) => ({
    category: r.category,
    targetText: r.category in budget.monthlyCents ? dollarsInputText(r.budgetCents) : "",
    hasTarget: r.category in budget.monthlyCents,
    budgetCents: r.budgetCents,
    spendCents: r.spendCents,
    varianceCents: r.varianceCents,
    variancePct: r.variancePct,
    status: r.status,
    statusLabel: STATUS_DISPLAY[r.status].label,
    statusIcon: STATUS_DISPLAY[r.status].icon,
    topContributors: r.topContributors.map(({ id, date, description, amountCents }) => ({
      id,
      date,
      description,
      amountCents,
    })),
  }));
  const spendCents = rows.reduce((s, r) => s + r.spendCents, 0);
  const budgetCents = rows.reduce((s, r) => s + r.budgetCents, 0);
  return {
    isEmpty: transactions.length === 0,
    month,
    monthLabel: monthLabel(month),
    months: monthsOf(transactions).map((value) => ({ value, label: monthLabel(value) })),
    rows,
    totals: {
      spendCents,
      budgetCents,
      varianceCents: spendCents - budgetCents,
      categoriesOver: rows.filter((r) => r.status === "over").length,
      unbudgetedSpendCents: rows
        .filter((r) => r.status === "unbudgeted")
        .reduce((s, r) => s + r.spendCents, 0),
    },
  };
}
