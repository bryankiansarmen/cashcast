import { defaultAssumptions } from "./store";
import { validateAssumptions } from "../engine/scenarios";
import type { Assumptions } from "../engine/types";

const KEY = "cashcast.assumptions.v1";
const BUCKETS = ["current", "d1_30", "d31_60", "d61_90", "d91_plus"];
const SCENARIOS = ["best", "expected", "worst"];

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

// Stored text is untrusted: check the shape before the engine validators see it.
function parseAssumptions(json: string): Assumptions | null {
  try {
    const a: unknown = JSON.parse(json);
    if (
      !isObject(a) ||
      a.version !== 1 ||
      !isObject(a.curves) ||
      !isObject(a.scenarios) ||
      !isObject(a.customers)
    )
      return null;
    if (!BUCKETS.every((b) => Array.isArray((a.curves as Record<string, unknown>)[b]))) return null;
    if (!SCENARIOS.every((s) => isObject((a.scenarios as Record<string, unknown>)[s]))) return null;
    if (!Object.values(a.customers).every(isObject)) return null;
    const assumptions = a as unknown as Assumptions;
    return validateAssumptions(assumptions).length === 0 ? assumptions : null;
  } catch {
    return null;
  }
}

const isDefault = (a: Assumptions) => {
  const d = defaultAssumptions();
  return (
    JSON.stringify([a.curves, a.scenarios, a.customers]) ===
    JSON.stringify([d.curves, d.scenarios, d.customers])
  );
};

/** Saved assumptions, or the defaults when nothing usable is stored. Unreadable or invalid data is not an error. */
export function loadAssumptions(): { assumptions: Assumptions; storageUnavailable: boolean } {
  try {
    const raw = localStorage.getItem(KEY);
    return {
      assumptions: (raw && parseAssumptions(raw)) || defaultAssumptions(),
      storageUnavailable: false,
    };
  } catch {
    return { assumptions: defaultAssumptions(), storageUnavailable: true };
  }
}

/** Persists edits; defaults clear the key so a future change to the defaults still reaches this user. Returns false when storage is blocked. */
export function saveAssumptions(a: Assumptions): boolean {
  try {
    if (isDefault(a)) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(a));
    return true;
  } catch {
    return false;
  }
}
