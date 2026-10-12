import { formatCurrency } from "../../viewmodels/format";
import { tableRows, type ForecastView } from "../../viewmodels/forecast-view";
import DataTable, { type Column } from "./DataTable";

type Row = ReturnType<typeof tableRows>[number];
const money = (key: "inflow" | "best" | "expected" | "worst", header: string): Column<Row> => ({
  key,
  header,
  cell: (r) => formatCurrency(r[key]),
  sortValue: (r) => r[key],
  numeric: true,
});

export default function ForecastTable({ view }: { view: ForecastView }) {
  const columns: Column<Row>[] = [
    { key: "week", header: "Week", cell: (r) => r.week },
    { key: "start", header: "Starts", cell: (r) => r.start },
    { key: "end", header: "Ends", cell: (r) => r.end },
    money("inflow", `Collections (${view.scenario})`),
    money("best", "Cumulative best"),
    money("expected", "Cumulative expected"),
    money("worst", "Cumulative worst"),
  ];
  return (
    <DataTable
      caption="Weekly forecast"
      columns={columns}
      rows={tableRows(view)}
      rowKey={(r) => r.week}
    />
  );
}
