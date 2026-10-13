import type { Transaction } from "../budget/types";
import { parseDate } from "../engine/dates";
import { parseMoneyToCents } from "../engine/money";
import { cleanName } from "./ar-aging";
import { readCsv } from "./csv";
import type { ImportIssue, ImportResult } from "./errors";
import { mapHeaders, type FieldSpec } from "./headers";

export const TRANSACTION_FIELDS: Record<
  "date" | "description" | "amount" | "debit" | "credit" | "category",
  FieldSpec
> = {
  date: { required: true, aliases: ["date", "transaction date", "posted date", "posting date"] },
  description: {
    required: true,
    aliases: ["description", "memo", "payee", "details", "narrative"],
  },
  // Either a signed amount, or separate debit and credit columns.
  amount: { required: false, aliases: ["amount", "transaction amount", "amt"] },
  debit: { required: false, aliases: ["debit", "debits", "withdrawal", "money out", "paid out"] },
  credit: { required: false, aliases: ["credit", "credits", "deposit", "money in", "paid in"] },
  category: { required: false, aliases: ["category", "categories"] },
};

/**
 * Imports a transactions CSV into signed cents, negative for money out. A signed Amount column is used when
 * present; otherwise debits become negative and credits positive. Any bad row fails the whole import.
 */
export function importTransactions(text: string): ImportResult<Transaction[]> {
  const csv = readCsv(text);
  if (!csv.ok) return csv;
  const cols = mapHeaders(csv.value.headers, TRANSACTION_FIELDS);
  if (!cols.ok) return cols;
  const c = cols.value;
  if (c.amount === undefined && c.debit === undefined && c.credit === undefined) {
    const accepted = ["amount", "debit", "credit"].flatMap(
      (f) => TRANSACTION_FIELDS[f as "amount"].aliases,
    );
    return {
      ok: false,
      errors: [
        {
          line: 1,
          column: "amount",
          message: `Missing an amount column. Provide a signed amount or debit and credit columns. Accepted headers: ${accepted.join(", ")}.`,
        },
      ],
    };
  }

  const errors: ImportIssue[] = [];
  const transactions: Transaction[] = [];
  for (const { line, cells } of csv.value.rows) {
    const cell = (i: number | undefined) => (i === undefined ? "" : (cells[i] ?? "").trim());
    const bad = (column: string, message: string) => errors.push({ line, column, message });

    const description = cleanName(cell(c.description));
    if (!description) bad("description", "Description is empty.");

    let date: string | undefined;
    if (!cell(c.date)) bad("date", "Date is missing.");
    else {
      const d = parseDate(cell(c.date));
      if (d.ok) date = d.value;
      else bad("date", `${d.error}. Use YYYY-MM-DD or M/D/YYYY.`);
    }

    const amountCents =
      c.amount === undefined
        ? debitCredit(cell(c.debit), cell(c.credit), bad)
        : signed(cell(c.amount), bad);
    if (description && date !== undefined && amountCents !== undefined) {
      const csvCategory = cell(c.category);
      transactions.push({
        id: `txn-${line}`,
        date,
        description,
        amountCents,
        ...(csvCategory && { csvCategory }),
      });
    }
  }
  if (errors.length) return { ok: false, errors };
  if (transactions.length === 0)
    return { ok: false, errors: [{ message: "The file has no data rows." }] };
  return { ok: true, value: transactions, warnings: cols.warnings };
}

type Bad = (column: string, message: string) => void;

function signed(text: string, bad: Bad): number | undefined {
  if (!text) return (bad("amount", "Amount is missing."), undefined);
  const m = parseMoneyToCents(text);
  if (!m.ok) return (bad("amount", m.error), undefined);
  if (m.value === 0) return (bad("amount", "Amount is zero."), undefined);
  return m.value;
}

function debitCredit(debit: string, credit: string, bad: Bad): number | undefined {
  if (!debit && !credit) return (bad("debit", "Enter a debit or a credit amount."), undefined);
  let total = 0;
  for (const [column, text, sign] of [
    ["debit", debit, -1],
    ["credit", credit, 1],
  ] as const) {
    if (!text) continue;
    const m = parseMoneyToCents(text);
    if (!m.ok) return (bad(column, m.error), undefined);
    if (m.value < 0)
      return (
        bad(
          column,
          "Debit and credit amounts are written without a minus sign; use an Amount column for signed values.",
        ),
        undefined
      );
    total += sign * m.value;
  }
  if (total === 0) return (bad("debit", "Amount is zero."), undefined);
  return total;
}
