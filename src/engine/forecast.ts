import { classify } from "./aging";
import { CURVE_LENGTH } from "./curves";
import type { Assumptions, Invoice, IsoDate, ScenarioId } from "./types";

export const HORIZON_WEEKS = 13;

/** Weekly inflow in cents (unrounded) for weeks 1 to 13; index 0 is week 1. */
export function distribute(
  invoice: Invoice,
  assumptions: Assumptions,
  scenario: ScenarioId,
  asOf: IsoDate,
): number[] {
  const { bucket, startWeek } = classify(invoice, asOf);
  const curve = assumptions.curves[bucket];
  const { factor, extraDelayWeeks } = assumptions.scenarios[scenario];
  const { delayWeeks = 0, reliability = 1 } = assumptions.customers[invoice.customerKey] ?? {};
  const curveSum = curve.reduce((a, b) => a + b, 0);
  const scale = curveSum === 0 ? 0 : Math.min(reliability * factor, 1 / curveSum);
  const firstWeek = startWeek + delayWeeks + extraDelayWeeks;
  const weeks = new Array<number>(HORIZON_WEEKS).fill(0);
  for (let k = 0; k < CURVE_LENGTH; k++) {
    const week = firstWeek + k;
    if (week <= HORIZON_WEEKS) weeks[week - 1] += invoice.openCents * curve[k] * scale;
  }
  return weeks;
}
