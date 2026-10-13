import { useState, type Dispatch } from "react";
import type { Action, CategoryRule } from "../../state/store";
import { validateRule } from "../../viewmodels/budget-view";
import type { ExplainId } from "../../viewmodels/explain";
import Card from "./Card";
import DataTable, { type Column } from "./DataTable";

const slug = (key: string) => key.replace(/[^a-z0-9]+/gi, "-");
type Row = CategoryRule & { order: number; last: boolean };

/**
 * Rules are checked in list order and the first match wins, so the order is editable. Edits to an existing rule
 * go to the store as text (it applies valid ones and records a message for the rest); a new rule is checked here
 * before it is sent.
 */
export default function RulesEditor({
  rules,
  errors,
  dispatch,
  onExplain,
}: {
  rules: readonly CategoryRule[];
  errors: Record<string, string>;
  dispatch: Dispatch<Action>;
  onExplain: (id: ExplainId) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [added, setAdded] = useState({ contains: "", category: "" });
  const [addErrors, setAddErrors] = useState<string[]>([]);
  const rows: Row[] = rules.map((r, i) => ({ ...r, order: i + 1, last: i === rules.length - 1 }));

  const input = (r: Row, field: "contains" | "category", label: string) => {
    const key = `rule.${r.id}.${field}`;
    const bad = key in errors;
    return (
      <input
        className="text-input"
        list={field === "category" ? "category-options" : undefined}
        aria-label={`Rule ${r.order}: ${label}`}
        aria-invalid={bad || undefined}
        aria-describedby={bad ? `err-${slug(key)}` : undefined}
        value={bad ? (drafts[key] ?? r[field]) : r[field]}
        onChange={(e) => {
          setDrafts((d) => ({ ...d, [key]: e.target.value }));
          dispatch({ type: "updateRule", id: r.id, field, text: e.target.value });
        }}
      />
    );
  };

  const columns: Column<Row>[] = [
    {
      key: "order",
      header: "Order",
      numeric: true,
      explain: "budget.ruleOrder",
      cell: (r) => r.order,
    },
    {
      key: "contains",
      header: "If the description contains",
      cell: (r) => input(r, "contains", "description contains"),
    },
    { key: "category", header: "Category", cell: (r) => input(r, "category", "category") },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <span className="actions">
          <button
            type="button"
            className="btn"
            disabled={r.order === 1}
            aria-label={`Move rule ${r.order} up`}
            onClick={() => dispatch({ type: "moveRule", id: r.id, direction: "up" })}
          >
            Up
          </button>
          <button
            type="button"
            className="btn"
            disabled={r.last}
            aria-label={`Move rule ${r.order} down`}
            onClick={() => dispatch({ type: "moveRule", id: r.id, direction: "down" })}
          >
            Down
          </button>
          <button
            type="button"
            className="btn"
            aria-label={`Delete rule ${r.order}`}
            onClick={() => dispatch({ type: "deleteRule", id: r.id })}
          >
            Delete
          </button>
        </span>
      ),
    },
  ];

  const add = () => {
    const problems = validateRule({
      contains: added.contains.trim(),
      category: added.category.trim(),
    });
    setAddErrors(problems);
    if (problems.length === 0) {
      dispatch({ type: "addRule", contains: added.contains, category: added.category });
      setAdded({ contains: "", category: "" });
    }
  };

  return (
    <Card title="Categorization rules">
      <div className="stack">
        <p className="hint">
          A transaction with a category in the file keeps it. Otherwise the first rule below whose
          text appears in the description decides the category, so order matters. Unmatched
          transactions are Uncategorized.
        </p>
        <DataTable
          caption="Categorization rules"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          empty="No rules yet. Add one below."
          onExplain={onExplain}
        />
        {Object.entries(errors).map(([key, message]) => (
          <p key={key} id={`err-${slug(key)}`} className="field-error" role="alert">
            {message}
          </p>
        ))}
        <fieldset className="add-rule">
          <legend>Add a rule</legend>
          <label>
            Description contains
            <input
              className="text-input"
              value={added.contains}
              aria-invalid={addErrors.length > 0 || undefined}
              aria-describedby={addErrors.length ? "err-new-rule" : undefined}
              onChange={(e) => setAdded({ ...added, contains: e.target.value })}
            />
          </label>
          <label>
            Category
            <input
              className="text-input"
              list="category-options"
              value={added.category}
              aria-invalid={addErrors.length > 0 || undefined}
              aria-describedby={addErrors.length ? "err-new-rule" : undefined}
              onChange={(e) => setAdded({ ...added, category: e.target.value })}
            />
          </label>
          <button type="button" className="btn btn-primary" onClick={add}>
            Add rule
          </button>
        </fieldset>
        {addErrors.length > 0 && (
          <p id="err-new-rule" className="field-error" role="alert">
            {addErrors.join(" ")}
          </p>
        )}
      </div>
    </Card>
  );
}
