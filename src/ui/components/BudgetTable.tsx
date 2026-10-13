import { useState, type Dispatch } from "react";
import type { Action } from "../../state/store";
import type { BudgetRow, BudgetView } from "../../viewmodels/budget-view";
import type { ExplainId } from "../../viewmodels/explain";
import { formatCurrency, formatPercent } from "../../viewmodels/format";
import DataTable, { type Column } from "./DataTable";

// Ids cannot contain spaces, so category names are turned into a safe slug.
const slug = (category: string) => category.replace(/[^a-z0-9]+/gi, "-");

/**
 * The variance table. Target inputs send raw text to the store, which stores valid dollar amounts as whole cents
 * and records a message for anything else; a field with a message keeps showing what was typed.
 */
export default function BudgetTable({
  view,
  errors,
  dispatch,
  onExplain,
}: {
  view: BudgetView;
  errors: Record<string, string>;
  dispatch: Dispatch<Action>;
  onExplain: (id: ExplainId) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const columns: Column<BudgetRow>[] = [
    { key: "category", header: "Category", cell: (r) => r.category, sortValue: (r) => r.category },
    {
      key: "target",
      header: "Monthly target ($)",
      numeric: true,
      explain: "budget.target",
      sortValue: (r) => r.budgetCents,
      cell: (r) => {
        const key = `target.${r.category}`;
        const bad = key in errors;
        return (
          <input
            className="cell-input"
            inputMode="decimal"
            placeholder="none"
            aria-label={`${r.category} monthly target in dollars`}
            aria-invalid={bad || undefined}
            aria-describedby={bad ? `err-${slug(key)}` : undefined}
            value={bad ? (drafts[key] ?? r.targetText) : r.targetText}
            onChange={(e) => {
              setDrafts((d) => ({ ...d, [key]: e.target.value }));
              dispatch({ type: "setBudgetTarget", category: r.category, text: e.target.value });
            }}
          />
        );
      },
    },
    {
      key: "spend",
      header: "Spend",
      numeric: true,
      explain: "budget.categorySpend",
      sortValue: (r) => r.spendCents,
      cell: (r) => formatCurrency(r.spendCents),
    },
    {
      key: "variance",
      header: "Variance",
      numeric: true,
      explain: "budget.categoryVariance",
      sortValue: (r) => r.varianceCents,
      cell: (r) =>
        `${formatCurrency(r.varianceCents)}${r.variancePct === null ? "" : ` (${formatPercent(r.variancePct, 1)})`}`,
    },
    {
      key: "status",
      header: "Status",
      explain: "budget.categoryStatus",
      sortValue: (r) => r.statusLabel,
      cell: (r) => (
        <span className={`badge badge-${r.status}`}>
          <span aria-hidden="true">{r.statusIcon}</span> {r.statusLabel}
        </span>
      ),
    },
    {
      key: "contributors",
      header: "Top contributors",
      explain: "budget.contributors",
      cell: (r) =>
        r.topContributors.length === 0 ? (
          "—"
        ) : (
          <details>
            <summary>{r.topContributors.length} largest</summary>
            <ol className="contributors">
              {r.topContributors.map((t) => (
                <li key={t.id}>
                  {t.description}, {t.date}: {formatCurrency(Math.abs(t.amountCents))}
                </li>
              ))}
            </ol>
          </details>
        ),
    },
  ];
  return (
    <div className="stack">
      <DataTable
        caption="Spending against monthly targets"
        columns={columns}
        rows={view.rows}
        rowKey={(r) => r.category}
        initialSort={{ key: "spend", dir: "desc" }}
        onExplain={onExplain}
      />
      {Object.entries(errors).map(([key, message]) => (
        <p key={key} id={`err-${slug(key)}`} className="field-error" role="alert">
          {message}
        </p>
      ))}
    </div>
  );
}
