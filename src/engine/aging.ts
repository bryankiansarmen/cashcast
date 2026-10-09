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
