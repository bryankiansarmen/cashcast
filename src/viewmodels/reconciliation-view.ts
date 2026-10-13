import { reconcile, type CheckFailure, type ReconcileInput } from "../engine/reconcile";

/** Kinds of figure the reconciliation indicator displays; the explain registry must cover them (INV-07). */
export const RECONCILIATION_EXPLAIN_IDS = ["reconciliation.status"] as const;

export interface ReconciliationView {
  status: "reconciled" | "blocked";
  label: string;
  /** One sentence for the indicator or the error banner. */
  summary: string;
  failures: CheckFailure[];
}

/** Turns the failed checks into the indicator state. Any failure blocks the forecast (INV-04). */
export function describeReconciliation(failures: readonly CheckFailure[]): ReconciliationView {
  if (failures.length === 0) {
    return {
      status: "reconciled",
      label: "Reconciled",
      summary: "All reconciliation checks passed.",
      failures: [],
    };
  }
  const ids = [...new Set(failures.map((f) => f.id))].sort().join(", ");
  return {
    status: "blocked",
    label: "Not reconciled",
    summary: `The forecast failed reconciliation (${ids}), so it is hidden.`,
    failures: [...failures],
  };
}

/** Runs `reconcile` on a set of results and describes the outcome. */
export const buildReconciliationView = (input: ReconcileInput): ReconciliationView =>
  describeReconciliation(reconcile(input));
