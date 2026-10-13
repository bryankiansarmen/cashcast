import type { ExplainId } from "../../viewmodels/explain";
import { formatCurrency, ROUNDING_FOOTNOTE } from "../../viewmodels/format";
import {
  ILLUSTRATIVE_LABEL,
  type ForecastView,
  type ScenarioId,
} from "../../viewmodels/forecast-view";
import Banner from "./Banner";
import Card from "./Card";
import ForecastChart from "./ForecastChart";
import ForecastTable from "./ForecastTable";
import MetricCard from "./MetricCard";
import ReconciliationStatus from "./ReconciliationStatus";
import ScenarioToggle from "./ScenarioToggle";

/** Shows the forecast, or only an error naming the failed checks when reconciliation fails (INV-04). */
export default function ForecastSection({
  view,
  onSelectScenario,
  onExplain,
  openId,
}: {
  view: ForecastView;
  onSelectScenario: (s: ScenarioId) => void;
  onExplain: (id: ExplainId) => void;
  openId: ExplainId | null;
}) {
  const status = (
    <ReconciliationStatus view={view.reconciliation} onExplain={onExplain} openId={openId} />
  );
  if (view.reconciliation.status === "blocked") return status; // nothing else is shown (INV-04)
  const { metrics } = view;
  return (
    <div className="page">
      {status}
      <div className="metric-grid">
        <MetricCard
          label="Expected collections, 13 weeks"
          value={formatCurrency(metrics.collectedCents)}
          context="Expected scenario, weeks 1 to 13"
          explainId="forecast.collected13"
          explainOpen={openId === "forecast.collected13"}
          onExplain={() => onExplain("forecast.collected13")}
        />
        <MetricCard
          label="Uncollected in horizon"
          value={formatCurrency(metrics.uncollectedCents)}
          context="Expected scenario, not collected within 13 weeks"
          explainId="forecast.uncollected"
          explainOpen={openId === "forecast.uncollected"}
          onExplain={() => onExplain("forecast.uncollected")}
        />
        <MetricCard
          label="Next 4 weeks"
          value={formatCurrency(metrics.next4Cents)}
          context="Expected scenario, weeks 1 to 4"
          explainId="forecast.next4"
          explainOpen={openId === "forecast.next4"}
          onExplain={() => onExplain("forecast.next4")}
        />
      </div>
      <Card title="13-week cash forecast">
        <div className="stack">
          <ScenarioToggle value={view.scenario} onChange={onSelectScenario} />
          {view.usingDefaults && <Banner kind="info">{ILLUSTRATIVE_LABEL}</Banner>}
          <ForecastChart view={view} />
          <ForecastTable view={view} onExplain={onExplain} />
          <p className="hint">{ROUNDING_FOOTNOTE}</p>
        </div>
      </Card>
    </div>
  );
}
