import type { ExplainId } from "../../viewmodels/explain";
import { formatCurrency } from "../../viewmodels/format";
import { tableRows, type ForecastView } from "../../viewmodels/forecast-view";
import DataTable, { type Column } from "./DataTable";

type Row = ReturnType<typeof tableRows>[number];
const money = (
  key: "inflow" | "best" | "expected" | "worst",
  header: string,
  explain: ExplainId,
): Column<Row> => ({
  key,
  header,
  explain,
  cell: (r) => formatCurrency(r[key]),
  sortValue: (r) => r[key],
  numeric: true,
});

export default function ForecastTable({
  view,
  onExplain,
}: {
  view: ForecastView;
  onExplain: (id: ExplainId) => void;
}) {
  const columns: Column<Row>[] = [
    { key: "week", header: "Week", cell: (r) => r.week },
    { key: "start", header: "Starts", cell: (r) => r.start },
    { key: "end", header: "Ends", cell: (r) => r.end },
    money("inflow", `Collections (${view.scenario})`, "forecast.weekInflow"),
    money("best", "Cumulative best", "forecast.weekCumulative"),
    money("expected", "Cumulative expected", "forecast.weekCumulative"),
    money("worst", "Cumulative worst", "forecast.weekCumulative"),
  ];
  return (
    <DataTable
      caption="Weekly forecast"
      columns={columns}
      rows={tableRows(view)}
      rowKey={(r) => r.week}
      onExplain={onExplain}
    />
  );
}
