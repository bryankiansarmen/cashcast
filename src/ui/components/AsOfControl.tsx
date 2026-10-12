import { useId } from "react";

interface Props {
  value: string;
  /** Sample data is pinned to its fixed date, so the input is locked. */
  locked: boolean;
  onChange: (iso: string) => void;
}

export default function AsOfControl({ value, locked, onChange }: Props) {
  const hint = useId();
  return (
    <div className="stack">
      <label>
        As-of date{" "}
        <input
          type="date"
          value={value}
          disabled={locked}
          aria-describedby={hint}
          onChange={(e) => e.target.value && onChange(e.target.value)}
        />
      </label>
      <small id={hint} className="hint">
        {locked
          ? "Sample data is fixed to this date. Import a file to choose your own."
          : "The forecast starts the day after this date."}
      </small>
    </div>
  );
}
