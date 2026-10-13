import { useState, type ReactNode } from "react";
import type { ExplainId } from "../../viewmodels/explain";
import { sortRows, type SortDir } from "../../viewmodels/table";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Makes the column sortable through a header button. */
  sortValue?: (row: T) => string | number;
  numeric?: boolean;
  /** Adds a "how is this calculated" button to the header. */
  explain?: ExplainId;
}

interface Props<T> {
  caption: string;
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  initialSort?: { key: string; dir: SortDir };
  onExplain?: (id: ExplainId) => void;
  /** Show every row without a vertical scroll box (still scrolls sideways when too wide). */
  full?: boolean;
}

export default function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  empty,
  initialSort,
  onExplain,
  full,
}: Props<T>) {
  const [sort, setSort] = useState(initialSort);
  const sortCol = columns.find((c) => c.key === sort?.key);
  const shown = sort && sortCol?.sortValue ? sortRows(rows, sortCol.sortValue, sort.dir) : rows;
  // First click sorts ascending; later clicks flip the direction.
  const toggle = (key: string) =>
    setSort((s) => ({ key, dir: s?.key === key && s.dir === "asc" ? "desc" : "asc" }));

  return (
    <div
      className={`table-scroll${full ? " table-full" : ""}`}
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table className="table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={c.numeric ? "num" : undefined}
                aria-sort={
                  sort?.key === c.key
                    ? sort.dir === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
              >
                {c.sortValue ? (
                  <button type="button" className="th-btn" onClick={() => toggle(c.key)}>
                    {c.header}
                    <span aria-hidden="true">
                      {sort?.key === c.key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                    </span>
                  </button>
                ) : (
                  c.header
                )}
                {c.explain && onExplain && (
                  <button
                    type="button"
                    className="th-explain"
                    data-explain-id={c.explain}
                    aria-label={`How ${c.header} is calculated`}
                    onClick={() => onExplain(c.explain!)}
                  >
                    ?
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td key={c.key} className={c.numeric ? "num" : undefined}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {shown.length === 0 && <div className="table-empty">{empty ?? "Nothing to show."}</div>}
    </div>
  );
}
