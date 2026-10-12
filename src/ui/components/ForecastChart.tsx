import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "../../viewmodels/format";
import {
  chartData,
  chartSummary,
  SCENARIO_LABELS,
  type ForecastView,
  type ScenarioId,
} from "../../viewmodels/forecast-view";

// Colour comes from tokens; line style carries the meaning too: expected solid, best dashed, worst dotted.
const SERIES: Record<ScenarioId, { stroke: string; dash?: string }> = {
  expected: { stroke: "var(--color-accent)" },
  best: { stroke: "var(--color-good)", dash: "8 4" },
  worst: { stroke: "var(--color-bad)", dash: "2 4" },
};

export default function ForecastChart({ view }: { view: ForecastView }) {
  const data = chartData(view);
  return (
    <div className="chart" role="img" aria-label={chartSummary(view)}>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="week" stroke="var(--color-muted)" />
          <YAxis
            stroke="var(--color-muted)"
            tickFormatter={(v: number) => formatCurrency(v)}
            width={96}
          />
          <Tooltip
            formatter={(v) => formatCurrency(Number(v))}
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          />
          <Legend />
          <Bar
            dataKey="inflow"
            name={`Weekly collections (${SCENARIO_LABELS[view.scenario].toLowerCase()})`}
            fill={SERIES[view.scenario].stroke}
            fillOpacity={0.35}
          />
          {(["expected", "best", "worst"] as const).map((id) => (
            <Line
              isAnimationActive={false}
              key={id}
              dataKey={id}
              name={`Cumulative ${id}`}
              type="monotone"
              stroke={SERIES[id].stroke}
              strokeDasharray={SERIES[id].dash}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
