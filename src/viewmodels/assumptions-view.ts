import { deriveCustomerDelays, MIN_PAID_INVOICES } from "../engine/customers";
import type { Assumptions, BucketId, Invoice, PaidInvoice, ScenarioId } from "../engine/types";
import { BUCKET_LABELS, BUCKET_ORDER } from "./aging-view";
import { formatPercent, percentInputText } from "./format";
import { SCENARIO_IDS, SCENARIO_LABELS } from "./forecast-view";

export interface CurveRow {
  id: BucketId;
  label: string;
  values: string[]; // percent text per week, for the inputs
  sum: string; // live total, e.g. "91.0%"
}
export interface ScenarioRow {
  id: ScenarioId;
  label: string;
  factor: string;
  extraDelayWeeks: string;
}
export interface CustomerRow {
  key: string;
  name: string;
  /** What the history says, e.g. "3 weeks, derived from 6 paid invoices". */
  derivedNote: string;
  /** Empty when there is no manual override. */
  delayText: string;
  reliabilityText: string; // percent, empty when not set
}
export interface AssumptionsView {
  curves: CurveRow[];
  scenarios: ScenarioRow[];
  customers: CustomerRow[];
}

const weeks = (n: number) => `${n} ${n === 1 ? "week" : "weeks"}`;
const paid = (n: number) => `${n} paid ${n === 1 ? "invoice" : "invoices"}`;

/** Text for the assumption editor's inputs, plus per-customer derived delays labelled as derived. */
export function buildAssumptionsView(
  assumptions: Assumptions,
  invoices: readonly Invoice[],
  history: readonly PaidInvoice[],
): AssumptionsView {
  const derived = deriveCustomerDelays(history);
  const names = new Map<string, string>();
  for (const inv of invoices)
    if (!names.has(inv.customerKey)) names.set(inv.customerKey, inv.customerName);
  return {
    curves: BUCKET_ORDER.map((id) => ({
      id,
      label: BUCKET_LABELS[id],
      values: assumptions.curves[id].map(percentInputText),
      sum: formatPercent(
        assumptions.curves[id].reduce((a, b) => a + b, 0),
        1,
      ),
    })),
    scenarios: SCENARIO_IDS.map((id) => ({
      id,
      label: SCENARIO_LABELS[id],
      factor: String(assumptions.scenarios[id].factor),
      extraDelayWeeks: String(assumptions.scenarios[id].extraDelayWeeks),
    })),
    customers: [...names].map(([key, name]) => {
      const d = derived[key];
      const manual = assumptions.customers[key] ?? {};
      return {
        key,
        name,
        derivedNote: !d
          ? "No payment history"
          : d.insufficientHistory
            ? `Insufficient history (${paid(d.paidCount)}; ${MIN_PAID_INVOICES} needed)`
            : `${weeks(d.delayWeeks)}, derived from ${paid(d.paidCount)}`,
        delayText: manual.delayWeeks === undefined ? "" : String(manual.delayWeeks),
        reliabilityText:
          manual.reliability === undefined ? "" : percentInputText(manual.reliability),
      };
    }),
  };
}
