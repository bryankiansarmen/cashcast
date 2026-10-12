import type { Dispatch } from "react";
import type { Action, State } from "../../state/store";
import { MAX_UPLOAD_BYTES, oversizeMessage } from "../../state/store";
import Banner from "../components/Banner";
import AsOfControl from "../components/AsOfControl";
import Card from "../components/Card";
import FileDropzone from "../components/FileDropzone";
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
  const statusFor = (kind: "ar" | "history") =>
    report?.kind === kind ? (report.ok ? "success" : "error") : undefined;
  // Sample data keeps its fixed date; a first import defaults to today, later imports keep the chosen date.
  const importAsOf = state.source === "sample" ? todayIso() : state.asOf;

  return (
    <div className="page">
      <h1>Forecast</h1>
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
    </div>
  );
}
