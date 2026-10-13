import type { Budget, CategoryRule, Transaction } from "../budget/types";
import { monthsOf } from "../budget/variance";
import { DEFAULT_CURVES, validateCurve } from "../engine/curves";
import { parseDate } from "../engine/dates";
import { parseMoneyToCents } from "../engine/money";
import { DEFAULT_SCENARIOS, validateCustomers, validateScenarios } from "../engine/scenarios";
import type {
  Assumptions,
  BucketId,
  Invoice,
  IsoDate,
  PaidInvoice,
  ScenarioId,
} from "../engine/types";
import { importArAging as parseArAging } from "../importers/ar-aging";
import { MAX_BYTES, oversizeMessage } from "../importers/csv";
import type { ImportIssue, ImportResult } from "../importers/errors";
import { importPaymentHistory } from "../importers/payment-history";
import { importTransactions as parseTransactions } from "../importers/transactions";
import { generateTransactionSample, SAMPLE_BUDGET, SAMPLE_RULES } from "../sample/budget-sample";
import { generateArSample } from "../sample/ar-sample";
import { SAMPLE_AS_OF } from "../sample/constants";

/** Largest file the UI should read; larger ones are rejected with `oversizeMessage` before reading. */
export const MAX_UPLOAD_BYTES = MAX_BYTES;
export { oversizeMessage };
export type { ImportIssue };

export type ImportKind = "ar" | "history" | "transactions";

export interface ImportReportData {
  kind: ImportKind;
  fileName: string;
  ok: boolean;
  count: number; // rows imported; 0 on failure
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

export interface State {
  invoices: Invoice[];
  history: PaidInvoice[];
  asOf: IsoDate;
  assumptions: Assumptions;
  scenario: ScenarioId;
  source: "sample" | "import";
  report: ImportReportData | null;
  /** Inline messages for rejected assumption edits, keyed by field (`curve.<bucket>.<week>`, and so on). */
  assumptionErrors: Record<string, string>;
  /** Browser storage is blocked, so assumption edits will not persist. */
  storageUnavailable: boolean;
  transactions: Transaction[];
  rules: CategoryRule[];
  budget: Budget;
  /** The month shown on the Budget page (YYYY-MM). */
  month: string;
  txSource: "sample" | "import";
  /** Result of the latest transactions import; separate from `report` so each page shows its own. */
  budgetReport: ImportReportData | null;
  /** Inline messages for rejected budget target edits, keyed `target.<category>`. */
  budgetErrors: Record<string, string>;
}

export type Action =
  | { type: "loadSample" }
  | { type: "importArAging"; text: string; fileName: string; asOf: IsoDate }
  | { type: "importHistory"; text: string; fileName: string }
  | { type: "importRejected"; kind: ImportKind; fileName: string; message: string }
  | { type: "setAsOf"; asOf: IsoDate }
  | { type: "selectScenario"; scenario: ScenarioId }
  | { type: "setCurve"; bucket: BucketId; index: number; text: string }
  | {
      type: "setScenarioParams";
      scenario: ScenarioId;
      field: "factor" | "extraDelayWeeks";
      text: string;
    }
  | { type: "setCustomer"; key: string; field: "delayWeeks" | "reliability"; text: string }
  | { type: "importTransactions"; text: string; fileName: string }
  | { type: "setBudgetTarget"; category: string; text: string }
  | { type: "selectMonth"; month: string }
  | { type: "loadBudgetSample" }
  | { type: "resetBudgetTargets" }
  | { type: "resetAssumptions" }
  | { type: "storageFailed" }
  | { type: "resetAll" };

const isIsoDate = (s: string) => {
  const d = parseDate(s);
  return d.ok && d.value === s;
};

export const defaultAssumptions = (): Assumptions => ({
  version: 1,
  curves: DEFAULT_CURVES,
  scenarios: DEFAULT_SCENARIOS,
  customers: {},
});

const sampleBudget = (): Budget => ({ monthlyCents: { ...SAMPLE_BUDGET.monthlyCents } });
const latestMonth = (txs: readonly Transaction[]): string => monthsOf(txs).at(-1) ?? "";

/** First visit: the seeded sample dataset is already loaded. */
export const initialState = (): State => ({
  invoices: generateArSample(),
  history: [],
  asOf: SAMPLE_AS_OF,
  assumptions: defaultAssumptions(),
  scenario: "expected",
  source: "sample",
  report: null,
  assumptionErrors: {},
  storageUnavailable: false,
  transactions: generateTransactionSample(),
  rules: SAMPLE_RULES,
  budget: sampleBudget(),
  month: latestMonth(generateTransactionSample()),
  txSource: "sample",
  budgetReport: null,
  budgetErrors: {},
});

const report = <T>(kind: ImportKind, fileName: string, r: ImportResult<T[]>): ImportReportData =>
  r.ok
    ? { kind, fileName, ok: true, count: r.value.length, errors: [], warnings: r.warnings }
    : { kind, fileName, ok: false, count: 0, errors: r.errors, warnings: [] };

// Edits arrive as raw text. A bad edit is not applied; its message is recorded against the field instead.
const PERCENT = /^\d+(\.\d{1,2})?$/;
const parsePercent = (text: string): number | null => {
  const t = text.trim();
  return PERCENT.test(t) && Number(t) <= 100 ? Number(t) / 100 : null;
};
const reject = (state: State, key: string, message: string): State => ({
  ...state,
  assumptionErrors: { ...state.assumptionErrors, [key]: message },
});
const without = <T>(obj: Record<string, T>, key: string): Record<string, T> =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
const accept = (state: State, key: string, assumptions: Assumptions): State => {
  return { ...state, assumptions, assumptionErrors: without(state.assumptionErrors, key) };
};

/** A failed import only records its report; the loaded dataset is never replaced (INV-11). */
export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "loadSample": {
      // Only the receivables side; budget data, assumptions, and the scenario stay as they are.
      const sample = initialState();
      return {
        ...state,
        invoices: sample.invoices,
        history: [],
        asOf: sample.asOf,
        source: "sample",
        report: null,
      };
    }
    case "importArAging": {
      const r = parseArAging(action.text, action.asOf);
      const rep = report("ar", action.fileName, r);
      return r.ok
        ? { ...state, invoices: r.value, asOf: action.asOf, source: "import", report: rep }
        : { ...state, report: rep };
    }
    case "importHistory": {
      const r = importPaymentHistory(action.text);
      const rep = report("history", action.fileName, r);
      return r.ok ? { ...state, history: r.value, report: rep } : { ...state, report: rep };
    }
    case "importRejected": {
      const rejected: ImportReportData = {
        kind: action.kind,
        fileName: action.fileName,
        ok: false,
        count: 0,
        errors: [{ message: action.message }],
        warnings: [],
      };
      return action.kind === "transactions"
        ? { ...state, budgetReport: rejected }
        : { ...state, report: rejected };
    }
    case "importTransactions": {
      const r = parseTransactions(action.text);
      const rep = report("transactions", action.fileName, r);
      return r.ok
        ? {
            ...state,
            transactions: r.value,
            month: latestMonth(r.value),
            txSource: "import",
            budgetReport: rep,
            budgetErrors: {},
          }
        : { ...state, budgetReport: rep };
    }
    case "setBudgetTarget": {
      const key = `target.${action.category}`;
      const text = action.text.trim();
      const monthlyCents = without(state.budget.monthlyCents, action.category); // a blank target clears it
      if (text !== "") {
        const m = parseMoneyToCents(text);
        if (!m.ok)
          return {
            ...state,
            budgetErrors: {
              ...state.budgetErrors,
              [key]: "Enter an amount in dollars, like 250 or 250.50.",
            },
          };
        if (m.value < 0)
          return {
            ...state,
            budgetErrors: { ...state.budgetErrors, [key]: "A target cannot be negative." },
          };
        monthlyCents[action.category] = m.value;
      }
      return { ...state, budget: { monthlyCents }, budgetErrors: without(state.budgetErrors, key) };
    }
    case "selectMonth":
      return monthsOf(state.transactions).includes(action.month)
        ? { ...state, month: action.month }
        : state;
    case "loadBudgetSample": {
      const sample = initialState();
      return {
        ...state,
        transactions: sample.transactions,
        rules: sample.rules,
        budget: sample.budget,
        month: sample.month,
        txSource: "sample",
        budgetReport: null,
        budgetErrors: {},
      };
    }
    case "resetBudgetTargets":
      return { ...state, budget: sampleBudget(), budgetErrors: {} };
    case "setAsOf":
      // Only a real calendar date in ISO form is accepted; anything else leaves the as-of date unchanged.
      return isIsoDate(action.asOf) ? { ...state, asOf: action.asOf } : state;
    case "selectScenario":
      return { ...state, scenario: action.scenario };
    case "setCurve": {
      const key = `curve.${action.bucket}.${action.index}`;
      const value = parsePercent(action.text);
      if (value === null) return reject(state, key, "Enter a number from 0 to 100.");
      const curve = state.assumptions.curves[action.bucket].map((v, i) =>
        i === action.index ? value : v,
      );
      const [problem] = validateCurve(curve, "This curve");
      if (problem) return reject(state, key, problem);
      return accept(state, key, {
        ...state.assumptions,
        curves: { ...state.assumptions.curves, [action.bucket]: curve },
      });
    }
    case "setScenarioParams": {
      const key = `scenario.${action.scenario}.${action.field}`;
      const t = action.text.trim();
      const ok = action.field === "factor" ? /^\d+(\.\d+)?$/.test(t) : /^\d+$/.test(t);
      if (!ok) {
        return reject(
          state,
          key,
          action.field === "factor"
            ? "Enter a number such as 1.1."
            : "Enter a whole number of weeks.",
        );
      }
      const scenarios = {
        ...state.assumptions.scenarios,
        [action.scenario]: {
          ...state.assumptions.scenarios[action.scenario],
          [action.field]: Number(t),
        },
      };
      const [problem] = validateScenarios(scenarios);
      if (problem) return reject(state, key, problem);
      return accept(state, key, { ...state.assumptions, scenarios });
    }
    case "setCustomer": {
      const key = `customer.${action.key}.${action.field}`;
      const t = action.text.trim();
      const current = state.assumptions.customers[action.key] ?? {};
      const others = without(current, action.field);
      let entry: typeof current = others; // an empty field clears the override
      if (t !== "") {
        const value =
          action.field === "reliability" ? parsePercent(t) : /^\d+$/.test(t) ? Number(t) : null;
        if (value === null) {
          return reject(
            state,
            key,
            action.field === "reliability"
              ? "Enter a number from 0 to 100."
              : "Enter a whole number of weeks.",
          );
        }
        entry = { ...others, [action.field]: value };
      }
      const rest = without(state.assumptions.customers, action.key);
      const customers = Object.keys(entry).length ? { ...rest, [action.key]: entry } : rest;
      const [problem] = validateCustomers(customers);
      if (problem) return reject(state, key, problem);
      return accept(state, key, { ...state.assumptions, customers });
    }
    case "resetAssumptions":
      return { ...state, assumptions: defaultAssumptions(), assumptionErrors: {} };
    case "storageFailed":
      return state.storageUnavailable ? state : { ...state, storageUnavailable: true };
    case "resetAll":
      return initialState();
  }
}
