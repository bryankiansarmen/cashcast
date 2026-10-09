import type { IsoDate } from "./dates";

export type { IsoDate };
export type BucketId = "current" | "d1_30" | "d31_60" | "d61_90" | "d91_plus";
export type ScenarioId = "best" | "expected" | "worst";

export interface Invoice {
  id: string; // generated: row index based, stable per import
  invoiceNumber: string; // as given; may be empty
  customerKey: string; // normalized lowercase key
  customerName: string; // display casing
  invoiceDate?: IsoDate;
  dueDate: IsoDate;
  openCents: number; // integer > 0
}

export type Curve = readonly number[]; // length 13

export interface Assumptions {
  version: 1;
  curves: Record<BucketId, Curve>;
  scenarios: Record<ScenarioId, { factor: number; extraDelayWeeks: number }>;
  customers: Record<string, { delayWeeks?: number; reliability?: number }>; // by customerKey
}

export interface ForecastResult {
  asOf: IsoDate;
  scenario: ScenarioId;
  weeks: {
    week: number;
    start: IsoDate;
    end: IsoDate;
    inflowCents: number;
    cumulativeCents: number;
  }[];
  uncollectedCents: number;
  totalOpenCents: number;
}
