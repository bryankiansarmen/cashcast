import type { Assumptions, IsoDate, ScenarioId } from "../engine/types";
import { AGING_EXPLAIN_IDS, BUCKET_LABELS, BUCKET_ORDER } from "./aging-view";
import { BUDGET_EXPLAIN_IDS, monthLabel } from "./budget-view";
import { formatPercent } from "./format";
import { FORECAST_EXPLAIN_IDS, SCENARIO_IDS, SCENARIO_LABELS } from "./forecast-view";
import { RECONCILIATION_EXPLAIN_IDS } from "./reconciliation-view";

/** Every kind of number the app displays has an entry here (INV-07). */
export const EXPLAIN_IDS = [
  ...AGING_EXPLAIN_IDS,
  ...FORECAST_EXPLAIN_IDS,
  ...RECONCILIATION_EXPLAIN_IDS,
  ...BUDGET_EXPLAIN_IDS,
  "assumptions.curveTotal",
] as const;
export type ExplainId = (typeof EXPLAIN_IDS)[number];

export interface ExplainEntry {
  title: string;
  /** How the figure is calculated, in the wording of the calculation spec. */
  formula: string;
  inputs: string[];
  /** Which assumptions feed the figure; the values in use are listed beside them. */
  assumptions: string[];
}

const NONE = "None. This figure uses no assumptions.";
const BUCKETS =
  "Buckets use days past due: Current is 0 or less, 1–30, 31–60, 61–90, and 91+ is 91 or more.";
const FORECAST_FORMULA =
  "For each invoice: delay = delayWeeks + extraDelayWeeks; scale = min(reliability × factor, 1 / curveSum). " +
  "For k = 0 to 12, the payment week is startWeek + k + delay, and inflow(week) = openCents × curve[k] × scale, " +
  "counted only if the week is 13 or less. Portfolio inflow is the sum over invoices.";
const FORECAST_INPUTS = [
  "Open amount and due date of every invoice",
  "The as-of date (daysPastDue = asOf minus dueDate, in whole days)",
  "The collection curve for the invoice's aging bucket",
];
const FORECAST_ASSUMPTIONS = [
  "Collection curves per bucket (illustrative defaults unless edited)",
  "Scenario factor and extra delay weeks",
  "Customer delay weeks (derived from payment history unless overridden) and reliability",
];

export const EXPLAIN: Record<ExplainId, ExplainEntry> = {
  "aging.totalOpen": {
    title: "Total open AR",
    formula:
      "Total open AR is the sum of openCents over every imported invoice line. Credits (negative balances) are excluded and never netted.",
    inputs: ["Open amount on each invoice line"],
    assumptions: [NONE],
  },
  "aging.pastDue": {
    title: "Past due AR",
    formula:
      "Past due AR is the sum of openCents for invoices with daysPastDue of 1 or more, where daysPastDue is asOf minus dueDate in whole days. " +
      "The percentage is past due AR divided by total open AR.",
    inputs: ["Open amount and due date of each invoice", "The as-of date"],
    assumptions: [NONE],
  },
  "aging.bucketCount": {
    title: "Invoices per bucket",
    formula: `The count of invoice lines whose daysPastDue falls in the bucket. ${BUCKETS}`,
    inputs: ["Due date of each invoice", "The as-of date"],
    assumptions: [NONE],
  },
  "aging.bucketTotal": {
    title: "Open AR per bucket",
    formula: `The sum of openCents for the invoices in the bucket. Bucket totals add up to total open AR. ${BUCKETS}`,
    inputs: ["Open amount and due date of each invoice", "The as-of date"],
    assumptions: [NONE],
  },
  "aging.bucketShare": {
    title: "Share of open AR",
    formula: "The bucket total divided by total open AR.",
    inputs: ["Bucket total", "Total open AR"],
    assumptions: [NONE],
  },
  "aging.customerBucket": {
    title: "Customer open AR by bucket",
    formula:
      "The sum of openCents for that customer's invoices in the bucket. Customer names are trimmed and matched ignoring case; the first-seen casing is shown.",
    inputs: ["Customer name, open amount, and due date of each invoice", "The as-of date"],
    assumptions: [NONE],
  },
  "aging.customerTotal": {
    title: "Customer total open AR",
    formula: "The sum of that customer's openCents across all buckets.",
    inputs: ["Customer name and open amount of each invoice"],
    assumptions: [NONE],
  },
  "forecast.collected13": {
    title: "Expected collections, 13 weeks",
    formula: `The sum of weekly inflow over weeks 1 to 13 in the expected scenario. ${FORECAST_FORMULA}`,
    inputs: FORECAST_INPUTS,
    assumptions: FORECAST_ASSUMPTIONS,
  },
  "forecast.uncollected": {
    title: "Uncollected in horizon",
    formula:
      "Total open AR minus expected collections over weeks 1 to 13, in the expected scenario. For each invoice, uncollected = openCents − sum of the invoice's inflows. " +
      "1 − curveSum is the share not collected within the horizon (late, written off, or never).",
    inputs: FORECAST_INPUTS,
    assumptions: FORECAST_ASSUMPTIONS,
  },
  "forecast.next4": {
    title: "Next 4 weeks",
    formula: `The sum of weekly inflow for weeks 1 to 4 in the expected scenario. Week n is days asOf + (n − 1) × 7 + 1 through asOf + n × 7, inclusive. ${FORECAST_FORMULA}`,
    inputs: FORECAST_INPUTS,
    assumptions: FORECAST_ASSUMPTIONS,
  },
  "forecast.weekInflow": {
    title: "Weekly collections",
    formula: `The portfolio inflow landing in that week, in the selected scenario. Week n is days asOf + (n − 1) × 7 + 1 through asOf + n × 7, inclusive. ${FORECAST_FORMULA}`,
    inputs: FORECAST_INPUTS,
    assumptions: FORECAST_ASSUMPTIONS,
  },
  "forecast.weekCumulative": {
    title: "Cumulative collections",
    formula: `The running sum of weekly inflow from week 1 through this week, for the scenario named in the column. ${FORECAST_FORMULA}`,
    inputs: FORECAST_INPUTS,
    assumptions: FORECAST_ASSUMPTIONS,
  },
  "reconciliation.status": {
    title: "Reconciliation status",
    formula:
      "Every forecast passes these checks before it is shown. R1: the sum of weekly inflows plus total uncollected equals total open AR, per scenario. " +
      "R2: bucket totals sum to total open AR. R3: every invoice's probabilities are at least 0 and sum to at most 1. " +
      "R4: cumulative worst is at most expected, which is at most best, in every week. " +
      "R5: no weekly inflow is negative, and cumulative inflow never decreases. If any check fails, the forecast is hidden.",
    inputs: [
      "The weekly forecast for the best, expected, and worst scenarios",
      "Every invoice and the aging buckets",
    ],
    assumptions: ["The same assumptions the forecast uses; the checks add none of their own"],
  },
  "budget.totalSpend": {
    title: "Total spend",
    formula:
      "The sum of spendCents over every category for the month. spendCents(category, month) is the negative of the sum of the transaction amounts for that category and month, so refunds reduce spend.",
    inputs: ["The amount, date, description, and category of every transaction"],
    assumptions: ["The categorization rules (listed by count below)"],
  },
  "budget.totalBudget": {
    title: "Total budget",
    formula:
      "The sum of the monthly targets you entered. budgetCents is the monthly target per category, and 0 if unset.",
    inputs: ["The monthly target you entered for each category"],
    assumptions: [NONE],
  },
  "budget.variance": {
    title: "Spend versus budget",
    formula:
      "variance = spendCents − budgetCents; positive means over budget. This card is total spend minus total budget, including spending in categories with no target.",
    inputs: ["Total spend", "Total budget"],
    assumptions: [NONE],
  },
  "budget.categoriesOver": {
    title: "Categories over budget",
    formula:
      "The number of categories whose status is over: the target is above 0 and spend exceeds budget.",
    inputs: ["Spend and monthly target for each category"],
    assumptions: ["The status thresholds: near is spend of at least 90% of budget"],
  },
  "budget.unbudgetedSpend": {
    title: "Unbudgeted spend",
    formula:
      "The spend in categories whose status is unbudgeted: budget is 0 and spend is above 0.",
    inputs: ["Spend and monthly target for each category"],
    assumptions: [NONE],
  },
  "budget.target": {
    title: "Monthly target",
    formula:
      "The amount you entered for the category, in dollars, stored as whole cents. A blank target means budgetCents is 0.",
    inputs: ["The amount you typed"],
    assumptions: [NONE],
  },
  "budget.categorySpend": {
    title: "Category spend",
    formula:
      "spendCents(category, month) is the negative of the sum of the transaction amounts for that category and month (refunds reduce spend). " +
      "A transaction's category is its CSV category if not blank, else the first matching rule in list order (case-insensitive substring of the description), else Uncategorized.",
    inputs: ["Transaction amounts, dates, descriptions, and CSV categories"],
    assumptions: ["The categorization rules, in list order"],
  },
  "budget.categoryVariance": {
    title: "Category variance",
    formula:
      "variance = spendCents − budgetCents; positive means over budget. variancePct = variance / budgetCents when budgetCents is above 0; otherwise not applicable.",
    inputs: ["Category spend", "Monthly target"],
    assumptions: [NONE],
  },
  "budget.categoryStatus": {
    title: "Budget status",
    formula:
      "unbudgeted if budget is 0 and spend is above 0; over if spend exceeds budget; near if spend is at least 90% of budget; otherwise on_track.",
    inputs: ["Category spend", "Monthly target"],
    assumptions: ["The 90% threshold for near"],
  },
  "budget.contributors": {
    title: "Top contributors",
    formula:
      "The 3 largest outflow transactions by absolute amount in the category and month; ties broken by earlier date, then input order.",
    inputs: ["Outflow transactions in the category and month"],
    assumptions: [NONE],
  },
  "budget.uncategorized": {
    title: "Uncategorized transactions",
    formula:
      "A transaction is uncategorized when it has no CSV category and no rule matches its description. A transaction's category is its CSV category if not blank, else the first matching rule in list order (case-insensitive substring of the description), else Uncategorized. Amounts are the transaction amounts as imported; negative means money out.",
    inputs: [
      "The month's transactions",
      "Each transaction's description, amount, and CSV category",
    ],
    assumptions: ["The categorization rules, in list order"],
  },
  "budget.ruleOrder": {
    title: "Rule order",
    formula:
      "Rules are checked in list order. The first rule whose text is contained in the description (case-insensitive) decides the category, so moving a rule up gives it priority. A CSV category on a transaction beats every rule.",
    inputs: ["The rule list and its order"],
    assumptions: [NONE],
  },
  "assumptions.curveTotal": {
    title: "Collection curve total",
    formula:
      "The sum of the 13 weekly percentages in a curve. A curve is valid when it has exactly 13 values, each between 0 and 100%, with a total of at most 100%. " +
      "100% minus the total is the share not collected within the horizon.",
    inputs: ["The 13 weekly percentages you entered for the bucket"],
    assumptions: ["The collection curve itself (illustrative default unless edited)"],
  },
};

export interface ExplainContext {
  assumptions: Assumptions;
  asOf: IsoDate;
  scenario: ScenarioId;
  usingDefaults: boolean;
  /** Budget page only: the month shown (YYYY-MM) and how many categorization rules apply. */
  month?: string;
  ruleCount?: number;
}
export interface ExplainView extends ExplainEntry {
  /** The current values behind the figure, so the explanation matches what is on screen. */
  values: { label: string; value: string }[];
}

const scenarioLine = (a: Assumptions, id: ScenarioId) =>
  `${SCENARIO_LABELS[id]}: factor ${a.scenarios[id].factor}, extra delay ${a.scenarios[id].extraDelayWeeks} ${a.scenarios[id].extraDelayWeeks === 1 ? "week" : "weeks"}`;

/** The entry for a figure plus the assumption values currently in use. */
export function explainView(id: ExplainId, ctx: ExplainContext): ExplainView {
  const a = ctx.assumptions;
  const values: ExplainView["values"] = [{ label: "As-of date", value: ctx.asOf }];
  const curves = {
    label: "Curve totals",
    value: BUCKET_ORDER.map(
      (b) =>
        `${BUCKET_LABELS[b]} ${formatPercent(
          a.curves[b].reduce((s, v) => s + v, 0),
          1,
        )}`,
    ).join(", "),
  };
  const customers = Object.values(a.customers);
  if (id.startsWith("forecast.")) {
    const scenarios: ScenarioId[] =
      id === "forecast.weekInflow"
        ? [ctx.scenario]
        : id === "forecast.weekCumulative"
          ? [...SCENARIO_IDS]
          : ["expected"];
    values.push(
      {
        label: scenarios.length > 1 ? "Scenarios" : "Scenario",
        value: scenarios.map((s) => scenarioLine(a, s)).join("; "),
      },
      curves,
      {
        label: "Customer delay overrides",
        value: String(customers.filter((c) => c.delayWeeks !== undefined).length),
      },
      {
        label: "Customer reliability settings",
        value: String(customers.filter((c) => c.reliability !== undefined).length),
      },
      {
        label: "Assumption source",
        value: ctx.usingDefaults
          ? "Illustrative defaults, not industry benchmarks"
          : "Edited by you",
      },
    );
  } else if (id.startsWith("budget.")) {
    values.splice(0, 1, { label: "Month", value: ctx.month ? monthLabel(ctx.month) : "" });
    values.push({ label: "Categorization rules", value: String(ctx.ruleCount ?? 0) });
  } else if (id === "reconciliation.status") {
    values.push({ label: "Checks run", value: "R1, R2, R3, R4, R5" });
  } else if (id === "assumptions.curveTotal") {
    values.splice(0, 1, curves);
  }
  return { ...EXPLAIN[id], values };
}
