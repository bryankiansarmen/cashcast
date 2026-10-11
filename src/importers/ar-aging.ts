import { parseDate } from "../engine/dates";
import { parseMoneyToCents } from "../engine/money";
import type { Invoice, IsoDate } from "../engine/types";
import { readCsv } from "./csv";
import type { ImportIssue, ImportResult } from "./errors";
import { importError } from "./errors";
import { mapHeaders, type FieldSpec } from "./headers";

export const AR_FIELDS: Record<
  "customer" | "invoiceNumber" | "invoiceDate" | "dueDate" | "open",
  FieldSpec
> = {
  customer: { required: true, aliases: ["customer", "customer name", "name", "client"] },
  invoiceNumber: {
    required: false,
    aliases: ["num", "invoice number", "invoice #", "invoice no", "invoice"],
  },
  invoiceDate: { required: false, aliases: ["invoice date", "date", "transaction date"] },
  dueDate: { required: true, aliases: ["due date", "duedate", "due"] },
  open: {
    required: true,
    aliases: ["open balance", "open amount", "balance", "outstanding", "amount due"],
  },
};

/** Trimmed, single-spaced customer name; its lowercase form is the customerKey shared by every importer. */
export const cleanName = (name: string) => name.trim().replace(/\s+/g, " ");

// Whole-dollar grouping from integer cents; no rounding happens here.
const usd = (cents: number) =>
  `$${Math.trunc(cents / 100).toLocaleString("en-US")}.${String(cents % 100).padStart(2, "0")}`;

/** Imports an AR aging CSV. Any bad row fails the whole import so no partial dataset is ever returned. */
export function importArAging(text: string, asOf: IsoDate): ImportResult<Invoice[]> {
  const csv = readCsv(text);
  if (!csv.ok) return csv;
  const cols = mapHeaders(csv.value.headers, AR_FIELDS);
  if (!cols.ok) return cols;
  const c = cols.value;

  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [...cols.warnings];
  const invoices: Invoice[] = [];
  const names = new Map<string, string>(); // customerKey -> first-seen display name
  const seenNumbers = new Set<string>();
  let duplicates = 0;
  let credits = 0;
  let creditCents = 0;
  let futureDated = 0;
  let firstFutureLine: number | undefined;

  for (const { line, cells } of csv.value.rows) {
    const cell = (i: number | undefined) => (i === undefined ? "" : (cells[i] ?? "").trim());
    const rowErrors: ImportIssue[] = [];
    const bad = (column: string, message: string) => rowErrors.push({ line, column, message });

    const customerName = cleanName(cell(c.customer));
    if (!customerName) bad("customer", "Customer name is empty.");

    let dueDate: IsoDate | undefined;
    if (!cell(c.dueDate)) bad("dueDate", "Due date is missing; due dates are never inferred.");
    else {
      const d = parseDate(cell(c.dueDate));
      if (d.ok) dueDate = d.value;
      else bad("dueDate", `${d.error}. Use YYYY-MM-DD or M/D/YYYY.`);
    }

    let openCents: number | undefined;
    if (!cell(c.open)) bad("open", "Open amount is missing.");
    else {
      const m = parseMoneyToCents(cell(c.open));
      if (!m.ok) bad("open", m.error);
      else if (m.value === 0) bad("open", "Open amount is zero.");
      else openCents = m.value;
    }

    let invoiceDate: IsoDate | undefined;
    if (cell(c.invoiceDate)) {
      const d = parseDate(cell(c.invoiceDate));
      if (d.ok) invoiceDate = d.value;
      else
        warnings.push({ line, column: "invoiceDate", message: `Invoice date ignored: ${d.error}` });
    }

    if (rowErrors.length) {
      errors.push(...rowErrors);
      continue;
    }
    if (openCents! < 0) {
      credits++;
      creditCents += -openCents!;
      continue;
    }
    if (invoiceDate && invoiceDate > asOf) {
      futureDated++;
      firstFutureLine ??= line;
    }
    const customerKey = customerName.toLowerCase();
    if (!names.has(customerKey)) names.set(customerKey, customerName);
    const invoiceNumber = cell(c.invoiceNumber);
    if (invoiceNumber) {
      const id = `${customerKey}\u0000${invoiceNumber}`;
      if (seenNumbers.has(id)) duplicates++;
      seenNumbers.add(id);
    }
    invoices.push({
      id: `inv-${line}`,
      invoiceNumber,
      customerKey,
      customerName: names.get(customerKey)!,
      invoiceDate,
      dueDate: dueDate!,
      openCents: openCents!,
    });
  }

  if (errors.length) return { ok: false, errors };
  if (invoices.length === 0) {
    return importError(
      credits
        ? "The file has only credits; there is nothing to forecast."
        : "The file has no data rows.",
    );
  }
  if (credits) {
    warnings.push({
      message: `Excluded ${credits} credit ${credits === 1 ? "line" : "lines"} totalling ${usd(creditCents)}; credits are never netted against invoices.`,
    });
  }
  if (duplicates) {
    warnings.push({
      message: `${duplicates} duplicate invoice ${duplicates === 1 ? "number" : "numbers"} for the same customer; kept as separate lines.`,
    });
  }
  if (futureDated) {
    warnings.push({
      line: firstFutureLine,
      message: `${futureDated} ${futureDated === 1 ? "invoice has" : "invoices have"} an invoice date after the as-of date (first at line ${firstFutureLine}).`,
    });
  }
  return { ok: true, value: invoices, warnings };
}
