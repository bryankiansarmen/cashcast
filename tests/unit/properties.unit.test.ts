import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { agingSummary } from "../../src/engine/aging";
import { CURVE_LENGTH, validateCurve } from "../../src/engine/curves";
import { addDays } from "../../src/engine/dates";
import { forecastAll } from "../../src/engine/forecast-all";
import { reconcile } from "../../src/engine/reconcile";
import { validateAssumptions } from "../../src/engine/scenarios";
import { assumptionsArb, portfolioArb } from "../support/arbitraries";

const params = { numRuns: 300 }; // a failing seed is printed by fast-check

describe("properties", () => {
  it("generated assumptions are valid", () => {
    fc.assert(
      fc.property(assumptionsArb, (a) => {
        expect(validateAssumptions(a)).toEqual([]);
      }),
      params,
    );
  });

  it("reconcile returns no failures for valid inputs (R1 to R5)", () => {
    fc.assert(
      fc.property(portfolioArb, ({ asOf, invoices, assumptions }) => {
        expect(forecastAll(invoices, assumptions, asOf).failures).toEqual([]);
      }),
      params,
    );
  });

  it("an accepted curve has 13 values in [0, 1] summing to at most 1; a rejected one violates one of those", () => {
    const wild = fc.array(
      fc.oneof(fc.double({ min: -0.5, max: 1.5 }), fc.double({ min: 0, max: 0.2, noNaN: true })),
      { maxLength: 15 },
    );
    fc.assert(
      fc.property(wild, (curve) => {
        const violates =
          curve.length !== CURVE_LENGTH ||
          curve.some((v) => !(v >= 0 && v <= 1)) ||
          curve.reduce((a, b) => a + b, 0) > 1 + 1e-9;
        expect(validateCurve(curve).length === 0).toBe(!violates);
      }),
      { numRuns: 1000 },
    );
  });

  it("cumulative worst <= expected <= best in every week", () => {
    fc.assert(
      fc.property(portfolioArb, ({ asOf, invoices, assumptions }) => {
        const { results } = forecastAll(invoices, assumptions, asOf);
        results.worst.weeks.forEach((w, i) => {
          expect(w.cumulativeCents).toBeLessThanOrEqual(
            results.expected.weeks[i].cumulativeCents + 1e-6,
          );
          expect(results.expected.weeks[i].cumulativeCents).toBeLessThanOrEqual(
            results.best.weeks[i].cumulativeCents + 1e-6,
          );
        });
      }),
      params,
    );
  });

  it("shifting asOf and every date by the same days leaves the forecast unchanged", () => {
    fc.assert(
      fc.property(
        portfolioArb,
        fc.integer({ min: -1000, max: 1000 }),
        ({ asOf, invoices, assumptions }, shift) => {
          const shiftedAsOf = addDays(asOf, shift);
          const shifted = invoices.map((inv) => ({ ...inv, dueDate: addDays(inv.dueDate, shift) }));
          const a = forecastAll(invoices, assumptions, asOf).results;
          const b = forecastAll(shifted, assumptions, shiftedAsOf).results;
          for (const s of ["best", "expected", "worst"] as const) {
            expect(b[s].weeks.map((w) => [w.inflowCents, w.cumulativeCents])).toEqual(
              a[s].weeks.map((w) => [w.inflowCents, w.cumulativeCents]),
            );
            expect(b[s].uncollectedCents).toBe(a[s].uncollectedCents);
          }
        },
      ),
      params,
    );
  });

  it("bucket totals sum to total open AR", () => {
    fc.assert(
      fc.property(portfolioArb, ({ asOf, invoices }) => {
        const s = agingSummary(invoices, asOf);
        const open = invoices.reduce((sum, i) => sum + i.openCents, 0);
        expect(Object.values(s.buckets).reduce((sum, b) => sum + b.totalCents, 0)).toBe(open);
        expect(s.totalCents).toBe(open);
        expect(s.customers.reduce((sum, c) => sum + c.totalCents, 0)).toBe(open);
      }),
      params,
    );
  });

  it("reconcile flags a forecast corrupted after the fact", () => {
    fc.assert(
      fc.property(
        portfolioArb.filter((p) => p.invoices.length > 0),
        ({ asOf, invoices, assumptions }) => {
          const { results } = forecastAll(invoices, assumptions, asOf);
          const bad = structuredClone(results);
          bad.expected.uncollectedCents += 1000;
          const failures = reconcile({
            invoices,
            assumptions,
            asOf,
            aging: agingSummary(invoices, asOf),
            results: bad,
          });
          expect(failures.map((f) => f.id)).toContain("R1");
        },
      ),
      params,
    );
  });
});
