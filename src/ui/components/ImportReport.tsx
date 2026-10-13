import type { ImportIssue, ImportReportData } from "../../state/store";
import Banner from "./Banner";
import DataTable, { type Column } from "./DataTable";

const MAX_SHOWN = 100;
type Row = ImportIssue & { i: number };
const columns: Column<Row>[] = [
  {
    key: "line",
    header: "Line",
    cell: (r) => r.line ?? "—",
    sortValue: (r) => r.line ?? 0,
    numeric: true,
  },
  { key: "column", header: "Column", cell: (r) => r.column ?? "—" },
  { key: "message", header: "Message", cell: (r) => r.message },
];

function IssueTable({ issues, caption }: { issues: ImportIssue[]; caption: string }) {
  const rows = issues.slice(0, MAX_SHOWN).map((e, i) => ({ ...e, i }));
  return (
    <>
      {issues.length > MAX_SHOWN && (
        <p>
          Showing the first {MAX_SHOWN} of {issues.length} problems.
        </p>
      )}
      <DataTable caption={caption} columns={columns} rows={rows} rowKey={(r) => String(r.i)} />
    </>
  );
}

/** Result of the latest import. Imported text is only ever rendered as text nodes. */
export default function ImportReport({ report }: { report: ImportReportData }) {
  const what = { ar: "invoices", history: "paid invoices", transactions: "transactions" }[
    report.kind
  ];
  if (!report.ok) {
    return (
      <div className="stack">
        <Banner kind="error">
          Could not import {report.fileName}. Your previous data is unchanged.
        </Banner>
        <IssueTable issues={report.errors} caption="Import errors" />
      </div>
    );
  }
  return (
    <div className="stack">
      <Banner kind="info">
        Imported {report.count} {what} from {report.fileName}.
      </Banner>
      {report.warnings.length > 0 && (
        <>
          <Banner kind="warning">
            {report.warnings.length} {report.warnings.length === 1 ? "warning" : "warnings"}; the
            data was imported.
          </Banner>
          <IssueTable issues={report.warnings} caption="Import warnings" />
        </>
      )}
    </div>
  );
}
