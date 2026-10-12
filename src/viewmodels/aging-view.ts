import { agingSummary, BUCKET_IDS } from "../engine/aging";
import type { BucketId, Invoice, IsoDate } from "../engine/types";

/** Buckets in display order, current first. */
export const BUCKET_ORDER: readonly BucketId[] = BUCKET_IDS;

export const BUCKET_LABELS: Record<BucketId, string> = {
  current: "Current",
  d1_30: "1–30",
  d31_60: "31–60",
  d61_90: "61–90",
  d91_plus: "91+",
};

/** Kinds of number the aging view displays; the explain registry must have an entry for each (INV-07). */
export const AGING_EXPLAIN_IDS = [
  "aging.totalOpen",
  "aging.pastDue",
  "aging.bucketCount",
  "aging.bucketTotal",
  "aging.bucketShare",
  "aging.customerBucket",
  "aging.customerTotal",
] as const;

export interface AgingBucketRow {
  id: BucketId;
  label: string;
  count: number;
  totalCents: number;
  share: number; // ratio of total open AR, 0 to 1
}

export interface AgingCustomerRow {
  key: string;
  name: string;
  totalCents: number;
  byBucketCents: Record<BucketId, number>;
}

export interface AgingView {
  asOf: IsoDate;
  isEmpty: boolean;
  invoiceCount: number;
  customerCount: number;
  totalOpenCents: number;
  pastDueCents: number;
  pastDueShare: number;
  buckets: AgingBucketRow[];
  customers: AgingCustomerRow[];
}

/** Display structure for the aging summary. Figures stay unrounded; the UI formats them. */
export function buildAgingView(invoices: readonly Invoice[], asOf: IsoDate): AgingView {
  const s = agingSummary(invoices, asOf);
  const share = (cents: number) => (s.totalCents === 0 ? 0 : cents / s.totalCents);
  const pastDueCents = s.totalCents - s.buckets.current.totalCents;
  return {
    asOf,
    isEmpty: invoices.length === 0,
    invoiceCount: invoices.length,
    customerCount: s.customers.length,
    totalOpenCents: s.totalCents,
    pastDueCents,
    pastDueShare: share(pastDueCents),
    buckets: BUCKET_IDS.map((id) => ({
      id,
      label: BUCKET_LABELS[id],
      count: s.buckets[id].count,
      totalCents: s.buckets[id].totalCents,
      share: share(s.buckets[id].totalCents),
    })),
    customers: s.customers.map((c) => ({
      key: c.customerKey,
      name: c.customerName,
      totalCents: c.totalCents,
      byBucketCents: c.byBucketCents,
    })),
  };
}
