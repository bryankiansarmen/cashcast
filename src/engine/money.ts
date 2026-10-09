export type MoneyResult = { ok: true; value: number } | { ok: false; error: string };

// Optional sign or parentheses, optional $, digits with optional comma grouping, up to 2 decimals.
const MONEY = /^(-)?\$?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;

export function parseMoneyToCents(text: string): MoneyResult {
  let s = text.trim();
  const parens = s.startsWith("(") && s.endsWith(")");
  if (parens) s = s.slice(1, -1).trim();
  const m = MONEY.exec(s);
  if (!m || (parens && m[1])) return { ok: false, error: `Invalid amount: "${text}"` };
  const cents = Number(m[2].replaceAll(",", "")) * 100 + Number((m[3] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return { ok: false, error: `Amount too large: "${text}"` };
  const negative = parens || Boolean(m[1]);
  return { ok: true, value: negative && cents !== 0 ? -cents : cents };
}
