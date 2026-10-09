import type { AgingSummary } from "./aging";
import { distribute } from "./forecast";
import type { Assumptions, ForecastResult, Invoice, IsoDate, ScenarioId } from "./types";

export type CheckId = "R1" | "R2" | "R3" | "R4" | "R5";
export interface CheckFailure {
  id: CheckId;
  message: string;
}

export interface ReconcileInput {
  invoices: readonly Invoice[];
  assumptions: Assumptions;
  asOf: IsoDate;
  aging: AgingSummary;
  results: Record<ScenarioId, ForecastResult>;
}

const SCENARIOS: ScenarioId[] = ["best", "expected", "worst"];
const R3_TOLERANCE = 1e-12;
const CENTS_TOLERANCE = 1e-6; // R4 and R5

/** Returns the failed checks; empty means the forecast may be displayed. */
export function reconcile({
  invoices,
  assumptions,
  asOf,
  aging,
  results,
}: ReconcileInput): CheckFailure[] {
  const failures: CheckFailure[] = [];
  const fail = (id: CheckId, message: string) => failures.push({ id, message });
  const totalOpen = invoices.reduce((sum, inv) => sum + inv.openCents, 0);

  // R1: weekly inflows plus uncollected equal total open AR, per scenario.
  const r1Tolerance = Math.max(1e-6, 1e-9 * totalOpen);
  for (const s of SCENARIOS) {
    const r = results[s];
    const inflows = r.weeks.reduce((sum, w) => sum + w.inflowCents, 0);
    const diff = Math.abs(inflows + r.uncollectedCents - totalOpen);
    if (diff > r1Tolerance || r.totalOpenCents !== totalOpen) {
      fail("R1", `${s}: inflows plus uncollected differ from total open AR by ${diff} cents.`);
    }
  }

  // R2: bucket totals sum to total open AR (exact).
  const bucketSum = Object.values(aging.buckets).reduce((sum, b) => sum + b.totalCents, 0);
  if (bucketSum !== totalOpen || aging.totalCents !== totalOpen) {
    fail("R2", `Bucket totals (${bucketSum}) do not equal total open AR (${totalOpen}).`);
  }

  // R3: every invoice's payment probabilities are at least 0 and sum to at most 1.
  r3: for (const s of SCENARIOS) {
    for (const inv of invoices) {
      const probs = distribute(inv, assumptions, s, asOf).map((v) => v / inv.openCents);
      if (probs.some((p) => !(p >= 0)) || probs.reduce((a, b) => a + b, 0) > 1 + R3_TOLERANCE) {
        fail("R3", `Invoice ${inv.id} (${s}) has payment probabilities outside 0 to 1.`);
        break r3;
      }
    }
  }

  // R4: cumulative worst <= expected <= best in every week.
  for (let i = 0; i < results.expected.weeks.length; i++) {
    const [w, e, b] = [results.worst, results.expected, results.best].map(
      (r) => r.weeks[i].cumulativeCents,
    );
    if (w > e + CENTS_TOLERANCE || e > b + CENTS_TOLERANCE) {
      fail("R4", `Scenario ordering broken in week ${i + 1}.`);
      break;
    }
  }

  // R5: no negative weekly inflow; cumulative never decreases.
  for (const s of SCENARIOS) {
    const bad = results[s].weeks.find(
      (w, i) =>
        w.inflowCents < -CENTS_TOLERANCE ||
        (i > 0 && w.cumulativeCents < results[s].weeks[i - 1].cumulativeCents - CENTS_TOLERANCE),
    );
    if (bad) fail("R5", `${s}: negative inflow or falling cumulative in week ${bad.week}.`);
  }
  return failures;
}
