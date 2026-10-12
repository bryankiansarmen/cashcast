import {
  BUCKET_LABELS,
  BUCKET_ORDER,
  type AgingBucketRow,
  type AgingCustomerRow,
  type AgingView,
} from "../../viewmodels/aging-view";
import { formatCurrency, formatPercent, ROUNDING_FOOTNOTE } from "../../viewmodels/format";
import Card from "./Card";
import DataTable, { type Column } from "./DataTable";
import EmptyState from "./EmptyState";
import MetricCard from "./MetricCard";

const bucketColumns: Column<AgingBucketRow>[] = [
  { key: "label", header: "Days past due", cell: (r) => r.label },
  {
    key: "count",
    header: "Invoices",
    cell: (r) => r.count,
    sortValue: (r) => r.count,
    numeric: true,
  },
  {
    key: "total",
    header: "Open AR",
    cell: (r) => formatCurrency(r.totalCents),
    sortValue: (r) => r.totalCents,
    numeric: true,
  },
  {
    key: "share",
    header: "Share",
    cell: (r) => formatPercent(r.share, 1),
    sortValue: (r) => r.share,
    numeric: true,
  },
];

const customerColumns: Column<AgingCustomerRow>[] = [
  { key: "name", header: "Customer", cell: (r) => r.name, sortValue: (r) => r.name },
  ...BUCKET_ORDER.map((id) => ({
    key: id,
    header: BUCKET_LABELS[id],
    cell: (r: AgingCustomerRow) => formatCurrency(r.byBucketCents[id]),
    sortValue: (r: AgingCustomerRow) => r.byBucketCents[id],
    numeric: true,
  })),
  {
    key: "total",
    header: "Total",
    cell: (r) => formatCurrency(r.totalCents),
    sortValue: (r) => r.totalCents,
    numeric: true,
  },
];

export default function AgingSummary({
  view,
  onLoadSample,
}: {
  view: AgingView;
  onLoadSample: () => void;
}) {
  if (view.isEmpty) {
    return (
      <EmptyState
        title="No receivables loaded"
        message="Load the sample data or import an AR aging file to see the aging summary."
        action={{ label: "Load sample data", onClick: onLoadSample }}
      />
    );
  }
  return (
    <div className="page">
      <div className="metric-grid">
        <MetricCard
          label="Total open AR"
          value={formatCurrency(view.totalOpenCents)}
          context={`${view.invoiceCount} invoices across ${view.customerCount} customers`}
        />
        <MetricCard
          label="Past due AR"
          value={formatCurrency(view.pastDueCents)}
          context={`${formatPercent(view.pastDueShare, 1)} of open AR`}
        />
      </div>
      <Card title={`Aging by bucket, as of ${view.asOf}`}>
        <DataTable
          caption="Aging by bucket"
          columns={bucketColumns}
          rows={view.buckets}
          rowKey={(r) => r.id}
        />
      </Card>
      <Card title="Aging by customer">
        <DataTable
          caption="Aging by customer"
          columns={customerColumns}
          rows={view.customers}
          rowKey={(r) => r.key}
          initialSort={{ key: "total", dir: "desc" }}
        />
        <p className="hint">{ROUNDING_FOOTNOTE}</p>
      </Card>
    </div>
  );
}
