import { addDays } from "../engine/dates";
import type { BucketId, Invoice } from "../engine/types";
import { SAMPLE_AR_SEED, SAMPLE_AS_OF } from "./constants";
import { mulberry32, randInt } from "./prng";

// Fictional customers; any resemblance to real businesses is coincidental.
export const SAMPLE_CUSTOMERS = [
  "Alder & Pine LLC",
  "Birchwood Print Co",
  "Cedar Row Dental",
  "Driftwood Analytics",
  "Ember Street Bakery",
  "Fennel & Co Catering",
  "Granite Peak Builders",
  "Harbor Light Marine",
  "Iron Kettle Foods",
  "Juniper Bay Clinic",
  "Kestrel Freight",
  "Lantern Hill Studio",
] as const;

// Invoice counts per bucket (60 in total) and the days-from-due range each one covers.
// Current is days until due; the others are days past due.
const PLAN: [BucketId, count: number, minDays: number, maxDays: number][] = [
  ["current", 24, 0, 60],
  ["d1_30", 14, 1, 30],
  ["d31_60", 10, 31, 60],
  ["d61_90", 7, 61, 90],
  ["d91_plus", 5, 91, 150],
];

/** About 60 synthetic invoices across 12 customers, identical on every call. */
export function generateArSample(): Invoice[] {
  const rng = mulberry32(SAMPLE_AR_SEED);
  const rows: { customer: string; dueDate: string; openCents: number }[] = [];
  for (const [bucket, count, minDays, maxDays] of PLAN) {
    for (let n = 0; n < count; n++) {
      const days = randInt(rng, minDays, maxDays);
      // The first twelve invoices cover every customer once; the rest are random.
      const customer =
        SAMPLE_CUSTOMERS[
          rows.length < SAMPLE_CUSTOMERS.length
            ? rows.length
            : randInt(rng, 0, SAMPLE_CUSTOMERS.length - 1)
        ];
      rows.push({
        customer,
        dueDate: addDays(SAMPLE_AS_OF, bucket === "current" ? days : -days),
        openCents: randInt(rng, 1200, 48_000) * 100 + randInt(rng, 0, 99),
      });
    }
  }
  rows.sort((a, b) => a.customer.localeCompare(b.customer) || a.dueDate.localeCompare(b.dueDate));
  return rows.map((r, i) => {
    const invoiceDate = addDays(r.dueDate, -30);
    return {
      id: `inv-${i + 2}`, // matches the file-line ids an import of the same data would give
      invoiceNumber: String(1001 + i),
      customerKey: r.customer.toLowerCase(),
      customerName: r.customer,
      invoiceDate: invoiceDate > SAMPLE_AS_OF ? SAMPLE_AS_OF : invoiceDate,
      dueDate: r.dueDate,
      openCents: r.openCents,
    };
  });
}
