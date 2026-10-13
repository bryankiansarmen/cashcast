import { useState, type Dispatch } from "react";
import type { Action } from "../../state/store";
import { validateRule, type BudgetView, type UncategorizedRow } from "../../viewmodels/budget-view";
import type { ExplainId } from "../../viewmodels/explain";
import { formatCurrency } from "../../viewmodels/format";
import Card from "./Card";
import DataTable, { type Column } from "./DataTable";

/** Transactions no rule or file category covers, each with a way to create the rule that would. */
export default function UncategorizedQueue({
  view,
  dispatch,
  onExplain,
}: {
  view: BudgetView;
  dispatch: Dispatch<Action>;
  onExplain: (id: ExplainId) => void;
}) {
  const [open, setOpen] = useState<{
    row: UncategorizedRow;
    contains: string;
    category: string;
  } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const rows = view.uncategorized;

  const columns: Column<UncategorizedRow>[] = [
    { key: "date", header: "Date", cell: (r) => r.date, sortValue: (r) => r.date },
    {
      key: "description",
      header: "Description",
      cell: (r) => r.description,
      sortValue: (r) => r.description,
    },
    {
      key: "amount",
      header: "Amount",
      numeric: true,
      explain: "budget.uncategorized",
      cell: (r) => formatCurrency(r.amountCents),
      sortValue: (r) => r.amountCents,
    },
    {
      key: "action",
      header: "Action",
      cell: (r) => (
        <button
          type="button"
          className="btn"
          aria-label={`Create a rule from ${r.description}`}
          onClick={() => {
            setErrors([]);
            setOpen({ row: r, contains: r.suggestedContains, category: "" });
          }}
        >
          Create rule
        </button>
      ),
    },
  ];

  const create = () => {
    if (!open) return;
    const problems = validateRule({
      contains: open.contains.trim(),
      category: open.category.trim(),
    });
    setErrors(problems);
    if (problems.length === 0) {
      dispatch({ type: "addRule", contains: open.contains, category: open.category });
      setOpen(null);
    }
  };

  return (
    <Card title={`Uncategorized transactions, ${view.monthLabel}`}>
      <div className="stack">
        {rows.length === 0 ? (
          <p>Nothing is uncategorized in {view.monthLabel}.</p>
        ) : (
          <>
            <p>
              {rows.length} {rows.length === 1 ? "transaction has" : "transactions have"} no
              category and no matching rule.
            </p>
            <DataTable
              caption="Uncategorized transactions"
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              onExplain={onExplain}
            />
          </>
        )}
        {open && (
          <fieldset className="add-rule">
            <legend>Create a rule from “{open.row.description}”</legend>
            <label>
              Description contains
              <input
                className="text-input"
                value={open.contains}
                aria-invalid={errors.length > 0 || undefined}
                aria-describedby={errors.length ? "err-queue-rule" : undefined}
                onChange={(e) => setOpen({ ...open, contains: e.target.value })}
              />
            </label>
            <label>
              Category
              <input
                className="text-input"
                list="category-options"
                value={open.category}
                aria-invalid={errors.length > 0 || undefined}
                aria-describedby={errors.length ? "err-queue-rule" : undefined}
                onChange={(e) => setOpen({ ...open, category: e.target.value })}
              />
            </label>
            <span className="actions">
              <button type="button" className="btn btn-primary" onClick={create}>
                Create rule
              </button>
              <button type="button" className="btn" onClick={() => setOpen(null)}>
                Cancel
              </button>
            </span>
          </fieldset>
        )}
        {errors.length > 0 && (
          <p id="err-queue-rule" className="field-error" role="alert">
            {errors.join(" ")}
          </p>
        )}
      </div>
    </Card>
  );
}
