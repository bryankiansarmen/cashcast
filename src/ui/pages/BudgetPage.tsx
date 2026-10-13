import { useMemo, useState, type Dispatch } from "react";
import type { Action, State } from "../../state/store";
import { MAX_UPLOAD_BYTES, oversizeMessage } from "../../state/store";
import { buildBudgetView } from "../../viewmodels/budget-view";
import { explainView, type ExplainId } from "../../viewmodels/explain";
import { formatCurrency, ROUNDING_FOOTNOTE } from "../../viewmodels/format";
import Banner from "../components/Banner";
import BudgetTable from "../components/BudgetTable";
import Card from "../components/Card";
import EmptyState from "../components/EmptyState";
import ExplainPanel from "../components/ExplainPanel";
import FileDropzone from "../components/FileDropzone";
import ImportReport from "../components/ImportReport";
import MetricCard from "../components/MetricCard";
import RulesEditor from "../components/RulesEditor";
import UncategorizedQueue from "../components/UncategorizedQueue";

export default function BudgetPage({
  state,
  dispatch,
}: {
  state: State;
  dispatch: Dispatch<Action>;
}) {
  const view = useMemo(
    () => buildBudgetView(state.transactions, state.rules, state.budget, state.month),
    [state.transactions, state.rules, state.budget, state.month],
  );
  const [explainId, setExplainId] = useState<ExplainId | null>(null);
  const report = state.budgetReport;
  const { totals } = view;
  const metric = (id: ExplainId, label: string, value: string, context: string) => (
    <MetricCard
      label={label}
      value={value}
      context={context}
      explainId={id}
      explainOpen={explainId === id}
      onExplain={() => setExplainId(id)}
    />
  );

  return (
    <div className="page">
      <h1>Budget</h1>
      {state.txSource === "sample" && (
        <Banner kind="info">
          Showing sample transactions: a fictional business, July to September 2026. Import your own
          file below.
        </Banner>
      )}
      <Card title="Data">
        <p>
          {state.transactions.length} transactions across {view.months.length}{" "}
          {view.months.length === 1 ? "month" : "months"}.
        </p>
        <FileDropzone
          label="Transactions CSV"
          maxBytes={MAX_UPLOAD_BYTES}
          oversizeMessage={oversizeMessage}
          status={report ? (report.ok ? "success" : "error") : undefined}
          onText={(text, fileName) => dispatch({ type: "importTransactions", text, fileName })}
          onReject={(message, fileName) =>
            dispatch({ type: "importRejected", kind: "transactions", fileName, message })
          }
        />
      </Card>
      {report && <ImportReport report={report} />}
      {view.isEmpty ? (
        <EmptyState
          title="No transactions loaded"
          message="Load the sample transactions or import a CSV to compare spending with targets."
          action={{
            label: "Load sample data",
            onClick: () => dispatch({ type: "loadBudgetSample" }),
          }}
        />
      ) : (
        <>
          <div className="field-row">
            <label htmlFor="month-select">Month</label>
            <select
              id="month-select"
              className="select"
              value={view.month}
              onChange={(e) => dispatch({ type: "selectMonth", month: e.target.value })}
            >
              {view.months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="metric-grid metric-grid-5">
            {metric(
              "budget.totalSpend",
              "Total spend",
              formatCurrency(totals.spendCents),
              view.monthLabel,
            )}
            {metric(
              "budget.totalBudget",
              "Total budget",
              formatCurrency(totals.budgetCents),
              "Sum of your monthly targets",
            )}
            {metric(
              "budget.variance",
              "Spend versus budget",
              formatCurrency(totals.varianceCents),
              totals.varianceCents > 0 ? "Over in total" : "Within budget in total",
            )}
            {metric(
              "budget.categoriesOver",
              "Categories over budget",
              String(totals.categoriesOver),
              "Spend above the target",
            )}
            {metric(
              "budget.unbudgetedSpend",
              "Unbudgeted spend",
              formatCurrency(totals.unbudgetedSpendCents),
              "Categories with no target",
            )}
          </div>
          <Card title={`Spending against targets, ${view.monthLabel}`}>
            <div className="stack">
              <BudgetTable
                view={view}
                errors={state.budgetErrors}
                dispatch={dispatch}
                onExplain={setExplainId}
              />
              <p className="hint">{ROUNDING_FOOTNOTE}</p>
              <button
                type="button"
                className="btn"
                onClick={() => dispatch({ type: "resetBudgetTargets" })}
              >
                Reset targets to the sample
              </button>
            </div>
          </Card>
          <UncategorizedQueue view={view} dispatch={dispatch} onExplain={setExplainId} />
          <RulesEditor
            rules={state.rules}
            errors={state.ruleErrors}
            dispatch={dispatch}
            onExplain={setExplainId}
          />
          <datalist id="category-options">
            {view.categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </>
      )}
      {explainId && (
        <ExplainPanel
          view={explainView(explainId, {
            assumptions: state.assumptions,
            asOf: state.asOf,
            scenario: state.scenario,
            usingDefaults: true,
            month: state.month,
            ruleCount: state.rules.length,
          })}
          onClose={() => setExplainId(null)}
        />
      )}
    </div>
  );
}
