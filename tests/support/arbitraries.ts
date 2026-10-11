import fc from "fast-check";
import { addDays, fromDayNumber } from "../../src/engine/dates";
import type { Assumptions, BucketId, Invoice, IsoDate } from "../../src/engine/types";

export const CUSTOMER_KEYS = ["acme", "beta", "gamma"] as const;
const BUCKETS: BucketId[] = ["current", "d1_30", "d31_60", "d61_90", "d91_plus"];

export const asOfArb: fc.Arbitrary<IsoDate> = fc
  .integer({ min: 0, max: 60_000 })
  .map(fromDayNumber);

/** A valid curve: 13 values in [0, 1] summing to at most 1 (sometimes exactly 0). */
export const curveArb: fc.Arbitrary<number[]> = fc
  .tuple(
    fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 13, maxLength: 13 }),
    fc.double({ min: 0, max: 1, noNaN: true }),
  )
  .map(([weights, total]) => {
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map((w) => (sum === 0 ? 0 : (w / sum) * total));
  });

const scenariosArb = fc
  .tuple(
    fc.array(fc.double({ min: 0.5, max: 1.5, noNaN: true }), { minLength: 3, maxLength: 3 }),
    fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 3, maxLength: 3 }),
  )
  .map(([factors, delays]) => {
    const f = [...factors].sort((a, b) => b - a); // best >= expected >= worst
    const d = [...delays].sort((a, b) => a - b); // best <= expected <= worst
    return {
      best: { factor: f[0], extraDelayWeeks: d[0] },
      expected: { factor: f[1], extraDelayWeeks: d[1] },
      worst: { factor: f[2], extraDelayWeeks: d[2] },
    };
  });

const adjustmentArb = fc.record(
  {
    delayWeeks: fc.integer({ min: 0, max: 8 }),
    reliability: fc.double({ min: 0, max: 1, noNaN: true }),
  },
  { requiredKeys: [] },
);

export const assumptionsArb: fc.Arbitrary<Assumptions> = fc
  .tuple(
    fc.array(curveArb, { minLength: 5, maxLength: 5 }),
    scenariosArb,
    fc.dictionary(fc.constantFrom(...CUSTOMER_KEYS), adjustmentArb),
  )
  .map(([curves, scenarios, customers]) => ({
    version: 1 as const,
    curves: Object.fromEntries(
      BUCKETS.map((b, i) => [b, curves[i]]),
    ) as unknown as Assumptions["curves"],
    scenarios,
    customers,
  }));

/** Invoices with due dates from 200 days overdue to 150 days ahead of asOf. */
export const invoicesArb = (asOf: IsoDate): fc.Arbitrary<Invoice[]> =>
  fc
    .array(
      fc.record({
        customerKey: fc.constantFrom(...CUSTOMER_KEYS),
        dueOffset: fc.integer({ min: -200, max: 150 }),
        openCents: fc.integer({ min: 1, max: 1_000_000_000 }),
      }),
      { maxLength: 15 },
    )
    .map((rows) =>
      rows.map((r, i) => ({
        id: `inv-${i}`,
        invoiceNumber: "",
        customerKey: r.customerKey,
        customerName: r.customerKey,
        dueDate: addDays(asOf, r.dueOffset),
        openCents: r.openCents,
      })),
    );

/** asOf, invoices, and assumptions together, since invoices depend on asOf. */
export const portfolioArb = asOfArb.chain((asOf) =>
  fc.record({ asOf: fc.constant(asOf), invoices: invoicesArb(asOf), assumptions: assumptionsArb }),
);
