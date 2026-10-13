import type { ExplainId } from "../../viewmodels/explain";
import type { ReconciliationView } from "../../viewmodels/reconciliation-view";
import Banner from "./Banner";

/** Healthy: a small "Reconciled" indicator with an explain button. Failed: an error naming the checks. */
export default function ReconciliationStatus({
  view,
  onExplain,
  openId,
}: {
  view: ReconciliationView;
  onExplain: (id: ExplainId) => void;
  openId: ExplainId | null;
}) {
  if (view.status === "blocked") {
    return (
      <Banner kind="error">
        {view.summary} {view.failures.map((f) => f.message).join(" ")}
      </Banner>
    );
  }
  return (
    <div className="recon" role="status">
      <span className="recon-pill">
        <span aria-hidden="true">✓</span> {view.label}
      </span>
      <button
        type="button"
        className="btn btn-link"
        data-explain-id="reconciliation.status"
        aria-expanded={openId === "reconciliation.status"}
        onClick={() => onExplain("reconciliation.status")}
      >
        Explain<span className="sr-only"> reconciliation</span>
      </button>
    </div>
  );
}
