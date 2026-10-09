import { diffDays } from "./dates";
import type { BucketId, Invoice, IsoDate } from "./types";

export function classify(
  invoice: Pick<Invoice, "dueDate">,
  asOf: IsoDate,
): { bucket: BucketId; startWeek: number } {
  const daysPastDue = diffDays(asOf, invoice.dueDate);
  if (daysPastDue <= 0)
    return { bucket: "current", startWeek: Math.max(1, Math.ceil(-daysPastDue / 7)) };
  const bucket =
    daysPastDue <= 30
      ? "d1_30"
      : daysPastDue <= 60
        ? "d31_60"
        : daysPastDue <= 90
          ? "d61_90"
          : "d91_plus";
  return { bucket, startWeek: 1 };
}

export const BUCKET_IDS: readonly BucketId[] = ["current", "d1_30", "d31_60", "d61_90", "d91_plus"];

export interface AgingSummary {
  totalCents: number;
  buckets: Record<BucketId, { totalCents: number; count: number }>;
  customers: {
    customerKey: string;
    customerName: string;
    totalCents: number;
    byBucketCents: Record<BucketId, number>;
  }[];
}

const zeroBuckets = (): Record<BucketId, number> => ({
  current: 0,
  d1_30: 0,
  d31_60: 0,
  d61_90: 0,
  d91_plus: 0,
});

export function agingSummary(invoices: readonly Invoice[], asOf: IsoDate): AgingSummary {
  const buckets = Object.fromEntries(
    BUCKET_IDS.map((b) => [b, { totalCents: 0, count: 0 }]),
  ) as AgingSummary["buckets"];
  const byKey = new Map<string, AgingSummary["customers"][number]>();
  let totalCents = 0;
  for (const inv of invoices) {
    const { bucket } = classify(inv, asOf);
    buckets[bucket].totalCents += inv.openCents;
    buckets[bucket].count += 1;
    totalCents += inv.openCents;
    // First-seen casing is displayed.
    let c = byKey.get(inv.customerKey);
    if (!c)
      byKey.set(
        inv.customerKey,
        (c = {
          customerKey: inv.customerKey,
          customerName: inv.customerName,
          totalCents: 0,
          byBucketCents: zeroBuckets(),
        }),
      );
    c.totalCents += inv.openCents;
    c.byBucketCents[bucket] += inv.openCents;
  }
  const customers = [...byKey.values()].sort(
    (a, b) => b.totalCents - a.totalCents || a.customerName.localeCompare(b.customerName),
  );
  return { totalCents, buckets, customers };
}
