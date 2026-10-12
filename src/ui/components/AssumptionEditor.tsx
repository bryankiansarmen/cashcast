import { useState, type Dispatch } from "react";
import type { Action, State } from "../../state/store";
import { buildAssumptionsView } from "../../viewmodels/assumptions-view";
import Card from "./Card";

/**
 * Edits go to the store as raw text. The store applies a valid edit or records a message for the field;
 * while a field has a message it keeps showing what was typed, so typing is never overwritten.
 */
export default function AssumptionEditor({
  state,
  dispatch,
}: {
  state: State;
  dispatch: Dispatch<Action>;
}) {
  const view = buildAssumptionsView(state.assumptions, state.invoices, state.history);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const errors = state.assumptionErrors;

  /** Props shared by every input: shown text, change handling, and the link to its inline message. */
  const field = (
    key: string,
    shown: string,
    label: string,
    send: (text: string) => Action,
    extra: object = {},
  ) => {
    const bad = key in errors;
    return {
      "aria-label": label,
      "aria-invalid": bad || undefined,
      "aria-describedby": bad ? `err-${key}` : undefined,
      value: bad ? (drafts[key] ?? shown) : shown,
      inputMode: "decimal" as const,
      onChange: (e: { target: { value: string } }) => {
        setDrafts((d) => ({ ...d, [key]: e.target.value }));
        dispatch(send(e.target.value));
      },
      ...extra,
    };
  };
  const messages = Object.entries(errors).map(([key, message]) => (
    <p key={key} id={`err-${key}`} className="field-error" role="alert">
      {message}
    </p>
  ));

  return (
    <Card title="Assumptions">
      <div className="stack">
        <p className="hint">
          Collection curves give the share of an invoice paid in each week after it is due (for
          current invoices, after the due week). Percentages in a curve may add up to at most 100%;
          the rest is treated as not collected within 13 weeks.
        </p>

        <div className="table-scroll" role="region" aria-label="Collection curves" tabIndex={0}>
          <table className="table">
            <caption className="sr-only">Collection curves, percent paid by week</caption>
            <thead>
              <tr>
                <th scope="col">Days past due</th>
                {Array.from({ length: 13 }, (_, i) => (
                  <th key={i} scope="col" className="num">
                    W{i + 1}
                  </th>
                ))}
                <th scope="col" className="num">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {view.curves.map((c) => (
                <tr key={c.id}>
                  <th scope="row">{c.label}</th>
                  {c.values.map((v, i) => {
                    const key = `curve.${c.id}.${i}`;
                    return (
                      <td key={i}>
                        <input
                          className="cell-input"
                          {...field(key, v, `${c.label} curve, week ${i + 1} (%)`, (text) => ({
                            type: "setCurve",
                            bucket: c.id,
                            index: i,
                            text,
                          }))}
                        />
                      </td>
                    );
                  })}
                  <td className="num" aria-label={`${c.label} curve total`}>
                    {c.sum}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-scroll" role="region" aria-label="Scenario parameters" tabIndex={0}>
          <table className="table">
            <caption className="sr-only">Scenario parameters</caption>
            <thead>
              <tr>
                <th scope="col">Scenario</th>
                <th scope="col">Collection factor</th>
                <th scope="col">Extra delay (weeks)</th>
              </tr>
            </thead>
            <tbody>
              {view.scenarios.map((s) => (
                <tr key={s.id}>
                  <th scope="row">{s.label}</th>
                  <td>
                    <input
                      className="cell-input"
                      {...field(
                        `scenario.${s.id}.factor`,
                        s.factor,
                        `${s.label} collection factor`,
                        (text) => ({
                          type: "setScenarioParams",
                          scenario: s.id,
                          field: "factor",
                          text,
                        }),
                      )}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input"
                      {...field(
                        `scenario.${s.id}.extraDelayWeeks`,
                        s.extraDelayWeeks,
                        `${s.label} extra delay in weeks`,
                        (text) => ({
                          type: "setScenarioParams",
                          scenario: s.id,
                          field: "extraDelayWeeks",
                          text,
                        }),
                      )}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-scroll" role="region" aria-label="Customer adjustments" tabIndex={0}>
          <table className="table">
            <caption className="sr-only">Customer adjustments</caption>
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Derived delay</th>
                <th scope="col">Delay override (weeks)</th>
                <th scope="col">Reliability (%)</th>
              </tr>
            </thead>
            <tbody>
              {view.customers.map((c) => (
                <tr key={c.key}>
                  <th scope="row">{c.name}</th>
                  <td>{c.derivedNote}</td>
                  <td>
                    <input
                      className="cell-input"
                      placeholder="derived"
                      {...field(
                        `customer.${c.key}.delayWeeks`,
                        c.delayText,
                        `${c.name} delay override in weeks`,
                        (text) => ({
                          type: "setCustomer",
                          key: c.key,
                          field: "delayWeeks",
                          text,
                        }),
                      )}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input"
                      placeholder="100"
                      {...field(
                        `customer.${c.key}.reliability`,
                        c.reliabilityText,
                        `${c.name} reliability (%)`,
                        (text) => ({
                          type: "setCustomer",
                          key: c.key,
                          field: "reliability",
                          text,
                        }),
                      )}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {messages}
        <button
          type="button"
          className="btn"
          onClick={() => {
            setDrafts({});
            dispatch({ type: "resetAssumptions" });
          }}
        >
          Reset assumptions to defaults
        </button>
      </div>
    </Card>
  );
}
