import { SCENARIO_IDS, SCENARIO_LABELS, type ScenarioId } from "../../viewmodels/forecast-view";

/** Native radio buttons: exactly one selected, and the arrow keys move the selection. */
export default function ScenarioToggle({
  value,
  onChange,
}: {
  value: ScenarioId;
  onChange: (scenario: ScenarioId) => void;
}) {
  return (
    <fieldset className="segmented">
      <legend>Scenario</legend>
      {SCENARIO_IDS.map((id) => (
        <label key={id} className={`segment${id === value ? " segment-on" : ""}`}>
          <input
            type="radio"
            name="scenario"
            value={id}
            checked={id === value}
            onChange={() => onChange(id)}
            className="sr-only"
          />
          {SCENARIO_LABELS[id]}
        </label>
      ))}
    </fieldset>
  );
}
