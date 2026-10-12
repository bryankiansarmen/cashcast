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
import ScenarioToggle from "./ScenarioToggle";

/** Shows the forecast, or only an error naming the failed checks when reconciliation fails (INV-04). */
export default function ForecastSection({
  view,
  onSelectScenario,
}: {
  view: ForecastView;
  onSelectScenario: (s: ScenarioId) => void;
}) {
  if (view.blocked.length > 0) {
    return (
      <Banner kind="error">
        The forecast failed reconciliation ({view.blocked.map((f) => f.id).join(", ")}), so it is
        hidden. {view.blocked.map((f) => f.message).join(" ")}
      </Banner>
    );
  }
  const { metrics } = view;
  return (
    <div className="page">
      <div className="metric-grid">
        <MetricCard
          label="Expected collections, 13 weeks"
          value={formatCurrency(metrics.collectedCents)}
          context="Expected scenario, weeks 1 to 13"
        />
        <MetricCard
          label="Uncollected in horizon"
          value={formatCurrency(metrics.uncollectedCents)}
          context="Expected scenario, not collected within 13 weeks"
        />
        <MetricCard
          label="Next 4 weeks"
          value={formatCurrency(metrics.next4Cents)}
          context="Expected scenario, weeks 1 to 4"
        />
      </div>
      <Card title="13-week cash forecast">
        <div className="stack">
          <ScenarioToggle value={view.scenario} onChange={onSelectScenario} />
          {view.usingDefaults && <Banner kind="info">{ILLUSTRATIVE_LABEL}</Banner>}
          <ForecastChart view={view} />
          <ForecastTable view={view} />
          <p className="hint">{ROUNDING_FOOTNOTE}</p>
        </div>
      </Card>
    </div>
  );
}
