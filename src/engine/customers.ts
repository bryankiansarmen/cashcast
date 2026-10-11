import { diffDays } from "./dates";
import type { Assumptions, PaidInvoice } from "./types";

export const MIN_PAID_INVOICES = 3;
export const MAX_DELAY_WEEKS = 8;

export interface DerivedDelay {
  delayWeeks: number;
  paidCount: number;
  insufficientHistory: boolean;
}

/** Mean days late (early counts as 0) divided by 7, rounded half up, clamped to 0 to 8. */
export function deriveCustomerDelays(paid: readonly PaidInvoice[]): Record<string, DerivedDelay> {
  const lateDays = new Map<string, number[]>();
  for (const p of paid) {
    const days = lateDays.get(p.customerKey) ?? [];
    days.push(Math.max(0, diffDays(p.paidDate, p.dueDate)));
    lateDays.set(p.customerKey, days);
  }
  const out: Record<string, DerivedDelay> = {};
  for (const [key, days] of lateDays) {
    const n = days.length;
    if (n < MIN_PAID_INVOICES) {
      out[key] = { delayWeeks: 0, paidCount: n, insufficientHistory: true };
      continue;
    }
    const sum = days.reduce((a, b) => a + b, 0);
    // floor(sum / (7n) + 1/2) in integers, so exact halves round up without float error.
    const weeks = Math.floor((2 * sum + 7 * n) / (14 * n));
    out[key] = {
      delayWeeks: Math.min(weeks, MAX_DELAY_WEEKS),
      paidCount: n,
      insufficientHistory: false,
    };
  }
  return out;
}

/** Merges derived delays into the customers map; a manual delayWeeks always wins. Input is not mutated. */
export function applyDerivedDelays(
  assumptions: Assumptions,
  derived: Record<string, DerivedDelay>,
): Assumptions {
  const customers = { ...assumptions.customers };
  for (const [key, d] of Object.entries(derived)) {
    if (d.insufficientHistory || customers[key]?.delayWeeks !== undefined) continue;
    customers[key] = { ...customers[key], delayWeeks: d.delayWeeks };
  }
  return { ...assumptions, customers };
}
