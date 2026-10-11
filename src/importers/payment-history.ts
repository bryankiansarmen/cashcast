import { parseDate } from "../engine/dates";
import type { PaidInvoice } from "../engine/types";
import { cleanName } from "./ar-aging";
import { readCsv } from "./csv";
import type { ImportIssue, ImportResult } from "./errors";
import { importError } from "./errors";
import { mapHeaders, type FieldSpec } from "./headers";

export const HISTORY_FIELDS: Record<"customer" | "dueDate" | "paidDate", FieldSpec> = {
  customer: { required: true, aliases: ["customer", "customer name", "name", "client"] },
  dueDate: { required: true, aliases: ["due date", "duedate", "due"] },
  paidDate: { required: true, aliases: ["paid date", "payment date", "date paid", "paid"] },
};

/** Imports paid invoices used to derive customer delay. Any bad row fails the whole import. */
export function importPaymentHistory(text: string): ImportResult<PaidInvoice[]> {
  const csv = readCsv(text);
  if (!csv.ok) return csv;
  const cols = mapHeaders(csv.value.headers, HISTORY_FIELDS);
  if (!cols.ok) return cols;
  const c = cols.value;

  const errors: ImportIssue[] = [];
  const paid: PaidInvoice[] = [];
  for (const { line, cells } of csv.value.rows) {
    const cell = (i: number | undefined) => (i === undefined ? "" : (cells[i] ?? "").trim());
    const name = cleanName(cell(c.customer));
    if (!name) errors.push({ line, column: "customer", message: "Customer name is empty." });
    const dates = (["dueDate", "paidDate"] as const).map((column) => {
      const raw = cell(c[column]);
      if (!raw) {
        errors.push({
          line,
          column,
          message: `${column === "dueDate" ? "Due" : "Paid"} date is missing.`,
        });
        return undefined;
      }
      const d = parseDate(raw);
      if (!d.ok) errors.push({ line, column, message: `${d.error}. Use YYYY-MM-DD or M/D/YYYY.` });
      return d.ok ? d.value : undefined;
    });
    // Paying before the due date is fine; the delay derivation counts it as 0 days late.
    if (name && dates[0] && dates[1])
      paid.push({ customerKey: name.toLowerCase(), dueDate: dates[0], paidDate: dates[1] });
  }
  if (errors.length) return { ok: false, errors };
  if (paid.length === 0) return importError("The file has no data rows.");
  return { ok: true, value: paid, warnings: cols.warnings };
}
