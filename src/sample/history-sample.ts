import { addDays } from "../engine/dates";
import type { PaidInvoice } from "../engine/types";
import { SAMPLE_AS_OF, SAMPLE_HISTORY_SEED } from "./constants";
import { mulberry32, randInt } from "./prng";

// [customer, paid invoices, earliest and latest days paid after due]. Negative means paid early.
// Four customers pay consistently late; two have too little history to derive a delay.
const PLAN: [customer: string, count: number, minLate: number, maxLate: number][] = [
  ["Alder & Pine LLC", 6, 14, 28],
  ["Driftwood Analytics", 5, 30, 45],
  ["Granite Peak Builders", 7, 50, 65],
  ["Kestrel Freight", 5, 12, 20],
  ["Birchwood Print Co", 6, -5, 4],
  ["Cedar Row Dental", 5, -3, 3],
  ["Ember Street Bakery", 7, -4, 5],
  ["Fennel & Co Catering", 4, -2, 2],
  ["Harbor Light Marine", 6, -5, 3],
  ["Iron Kettle Foods", 5, 0, 5],
  ["Juniper Bay Clinic", 1, 3, 3],
  ["Lantern Hill Studio", 2, 5, 9],
];

/** Seeded paid-invoice history for the sample customers, identical on every call. */
export function generateHistorySample(): PaidInvoice[] {
  const rng = mulberry32(SAMPLE_HISTORY_SEED);
  return PLAN.flatMap(([customer, count, minLate, maxLate]) =>
    Array.from({ length: count }, () => {
      // Due at least 70 days before as-of so every payment (at most 65 days late) is already in the past.
      const dueDate = addDays(SAMPLE_AS_OF, -randInt(rng, 70, 220));
      return {
        customerKey: customer.toLowerCase(),
        dueDate,
        paidDate: addDays(dueDate, randInt(rng, minLate, maxLate)),
      };
    }).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
  );
}
