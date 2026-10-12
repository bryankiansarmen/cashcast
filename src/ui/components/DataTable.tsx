import { useState, type ReactNode } from "react";
import { sortRows, type SortDir } from "../../viewmodels/table";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Makes the column sortable through a header button. */
  sortValue?: (row: T) => string | number;
  numeric?: boolean;
}

interface Props<T> {
  caption: string;
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  initialSort?: { key: string; dir: SortDir };
}

export default function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  empty,
  initialSort,
}: Props<T>) {
  const [sort, setSort] = useState(initialSort);
  const sortCol = columns.find((c) => c.key === sort?.key);
  const shown = sort && sortCol?.sortValue ? sortRows(rows, sortCol.sortValue, sort.dir) : rows;
  // First click sorts ascending; later clicks flip the direction.
  const toggle = (key: string) =>
    setSort((s) => ({ key, dir: s?.key === key && s.dir === "asc" ? "desc" : "asc" }));

  return (
    <div className="table-scroll" role="region" aria-label={caption} tabIndex={0}>
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
