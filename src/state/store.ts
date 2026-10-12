import { DEFAULT_CURVES } from "../engine/curves";
import { DEFAULT_SCENARIOS } from "../engine/scenarios";
import type { Assumptions, Invoice, IsoDate, PaidInvoice, ScenarioId } from "../engine/types";
import { importArAging as parseArAging } from "../importers/ar-aging";
import { MAX_BYTES, oversizeMessage } from "../importers/csv";
import type { ImportIssue, ImportResult } from "../importers/errors";
import { importPaymentHistory } from "../importers/payment-history";
import { generateArSample } from "../sample/ar-sample";
import { SAMPLE_AS_OF } from "../sample/constants";

/** Largest file the UI should read; larger ones are rejected with `oversizeMessage` before reading. */
export const MAX_UPLOAD_BYTES = MAX_BYTES;
export { oversizeMessage };
export type { ImportIssue };

export type ImportKind = "ar" | "history";

export interface ImportReportData {
  kind: ImportKind;
  fileName: string;
  ok: boolean;
  count: number; // rows imported; 0 on failure
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

export interface State {
  invoices: Invoice[];
  history: PaidInvoice[];
  asOf: IsoDate;
  assumptions: Assumptions;
  scenario: ScenarioId;
  source: "sample" | "import";
  report: ImportReportData | null;
}

export type Action =
  | { type: "loadSample" }
  | { type: "importArAging"; text: string; fileName: string; asOf: IsoDate }
  | { type: "importHistory"; text: string; fileName: string }
  | { type: "importRejected"; kind: ImportKind; fileName: string; message: string }
  | { type: "setAsOf"; asOf: IsoDate }
  | { type: "selectScenario"; scenario: ScenarioId }
  | { type: "resetAll" };

const defaultAssumptions = (): Assumptions => ({
  version: 1,
  curves: DEFAULT_CURVES,
  scenarios: DEFAULT_SCENARIOS,
  customers: {},
});

/** First visit: the seeded sample dataset is already loaded. */
export const initialState = (): State => ({
  invoices: generateArSample(),
  history: [],
  asOf: SAMPLE_AS_OF,
  assumptions: defaultAssumptions(),
  scenario: "expected",
  source: "sample",
  report: null,
});

const report = <T>(kind: ImportKind, fileName: string, r: ImportResult<T[]>): ImportReportData =>
  r.ok
    ? { kind, fileName, ok: true, count: r.value.length, errors: [], warnings: r.warnings }
    : { kind, fileName, ok: false, count: 0, errors: r.errors, warnings: [] };

/** A failed import only records its report; the loaded dataset is never replaced (INV-11). */
export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "loadSample":
      return { ...initialState(), assumptions: state.assumptions, scenario: state.scenario };
    case "importArAging": {
      const r = parseArAging(action.text, action.asOf);
      const rep = report("ar", action.fileName, r);
      return r.ok
        ? { ...state, invoices: r.value, asOf: action.asOf, source: "import", report: rep }
        : { ...state, report: rep };
    }
    case "importHistory": {
      const r = importPaymentHistory(action.text);
      const rep = report("history", action.fileName, r);
      return r.ok ? { ...state, history: r.value, report: rep } : { ...state, report: rep };
    }
    case "importRejected":
      return {
        ...state,
        report: {
          kind: action.kind,
          fileName: action.fileName,
          ok: false,
          count: 0,
          errors: [{ message: action.message }],
          warnings: [],
        },
      };
    case "setAsOf":
      return { ...state, asOf: action.asOf };
    case "selectScenario":
      return { ...state, scenario: action.scenario };
    case "resetAll":
      return initialState();
  }
}
