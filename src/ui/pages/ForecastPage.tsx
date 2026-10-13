import { useMemo, useState, type Dispatch } from "react";
import type { Action, State } from "../../state/store";
import { MAX_UPLOAD_BYTES, oversizeMessage } from "../../state/store";
import { buildAgingView } from "../../viewmodels/aging-view";
import { explainView, type ExplainId } from "../../viewmodels/explain";
import { buildForecastView } from "../../viewmodels/forecast-view";
import AgingSummary from "../components/AgingSummary";
import Banner from "../components/Banner";
import AsOfControl from "../components/AsOfControl";
import AssumptionEditor from "../components/AssumptionEditor";
import Card from "../components/Card";
import ExplainPanel from "../components/ExplainPanel";
import FileDropzone from "../components/FileDropzone";
import ForecastSection from "../components/ForecastSection";
import ImportReport from "../components/ImportReport";

// Local calendar date as YYYY-MM-DD (the en-CA locale prints ISO order).
const todayIso = () => new Date().toLocaleDateString("en-CA");

export default function ForecastPage({
  state,
  dispatch,
}: {
  state: State;
  dispatch: Dispatch<Action>;
}) {
  const { report } = state;
  const [storageNoticeOpen, setStorageNoticeOpen] = useState(true);
  const [explainId, setExplainId] = useState<ExplainId | null>(null);
  const forecast = useMemo(
    () =>
      buildForecastView(
        state.invoices,
        state.history,
        state.assumptions,
        state.asOf,
        state.scenario,
      ),
    [state.invoices, state.history, state.assumptions, state.asOf, state.scenario],
  );
  const aging = useMemo(
    () => buildAgingView(state.invoices, state.asOf),
    [state.invoices, state.asOf],
  );
  const statusFor = (kind: "ar" | "history") =>
    report?.kind === kind ? (report.ok ? "success" : "error") : undefined;
  // Sample data keeps its fixed date; a first import defaults to today, later imports keep the chosen date.
  const importAsOf = state.source === "sample" ? todayIso() : state.asOf;

  return (
    <div className="page">
      <h1>Forecast</h1>
      {state.storageUnavailable && storageNoticeOpen && (
        <Banner
          kind="info"
          action={{ label: "Dismiss", onClick: () => setStorageNoticeOpen(false) }}
        >
          Your browser is blocking storage, so changes to assumptions will not be saved after you
          close this page.
        </Banner>
      )}
      {state.source === "sample" && (
        <Banner kind="info">
          Showing sample data: fictional customers, as of {state.asOf}. Import your own AR aging
          file below.
        </Banner>
      )}
      <Card title="Data">
        <p>
          {state.invoices.length} invoices as of {state.asOf}
          {state.history.length > 0 && `, with ${state.history.length} paid invoices of history`}.
        </p>
        <AsOfControl
          value={state.asOf}
          locked={state.source === "sample"}
          onChange={(asOf) => dispatch({ type: "setAsOf", asOf })}
        />
        <div className="drop-grid">
          <FileDropzone
            label="AR aging CSV"
            maxBytes={MAX_UPLOAD_BYTES}
            oversizeMessage={oversizeMessage}
            status={statusFor("ar")}
            onText={(text, fileName) =>
              dispatch({ type: "importArAging", text, fileName, asOf: importAsOf })
            }
            onReject={(message, fileName) =>
              dispatch({ type: "importRejected", kind: "ar", fileName, message })
            }
          />
          <FileDropzone
            label="Payment history CSV (optional)"
            maxBytes={MAX_UPLOAD_BYTES}
            oversizeMessage={oversizeMessage}
            status={statusFor("history")}
            onText={(text, fileName) => dispatch({ type: "importHistory", text, fileName })}
            onReject={(message, fileName) =>
              dispatch({ type: "importRejected", kind: "history", fileName, message })
            }
          />
        </div>
      </Card>
      {report && <ImportReport report={report} />}
      {state.invoices.length > 0 && (
        <ForecastSection
          view={forecast}
          onSelectScenario={(scenario) => dispatch({ type: "selectScenario", scenario })}
          onExplain={setExplainId}
          openId={explainId}
        />
      )}
      <AssumptionEditor state={state} dispatch={dispatch} onExplain={setExplainId} />
      <AgingSummary
        view={aging}
        onLoadSample={() => dispatch({ type: "loadSample" })}
        onExplain={setExplainId}
        openId={explainId}
      />
      {explainId && (
        <ExplainPanel
          view={explainView(explainId, {
            assumptions: state.assumptions,
            asOf: state.asOf,
            scenario: state.scenario,
            usingDefaults: forecast.usingDefaults,
          })}
          onClose={() => setExplainId(null)}
        />
      )}
    </div>
  );
}
