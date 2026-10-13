interface Props {
  label: string;
  value: string;
  context?: string;
  loading?: boolean;
  error?: string;
  /** Opens the explain panel; the button is omitted when absent. */
  onExplain?: () => void;
  explainOpen?: boolean;
  /** Identifies the figure's explain entry. */
  explainId?: string;
}

export default function MetricCard({
  label,
  value,
  context,
  loading,
  error,
  onExplain,
  explainOpen = false,
  explainId,
}: Props) {
  return (
    <div className="card metric">
      <div className="metric-label">{label}</div>
      {loading ? (
        <div className="skeleton" role="status" aria-label={`Loading ${label}`} />
      ) : error ? (
        <div className="metric-error" role="alert">
          {error}
        </div>
      ) : (
        <>
          <div className="metric-value num">{value}</div>
          {context && <div className="metric-context">{context}</div>}
        </>
      )}
      {onExplain && !loading && !error && (
        <button
          type="button"
          className="btn btn-link"
          data-explain-id={explainId}
          aria-expanded={explainOpen}
          onClick={onExplain}
        >
          Explain<span className="sr-only"> {label}</span>
        </button>
      )}
    </div>
  );
}
