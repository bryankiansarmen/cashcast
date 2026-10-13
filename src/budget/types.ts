import type { IsoDate } from "../engine/dates";

export interface Transaction {
  id: string;
  date: IsoDate;
  description: string;
  amountCents: number; // negative = money out
  csvCategory?: string;
}

/** `contains` is matched case-insensitively as a substring of a transaction's description. */
export interface CategoryRule {
  id: string;
  contains: string;
  category: string;
}

export interface Budget {
  monthlyCents: Record<string, number>; // monthly target by category
}

/** Always exists; holds transactions that match neither a CSV category nor a rule. */
export const UNCATEGORIZED = "Uncategorized";
export const MAX_CATEGORY_LENGTH = 40;
