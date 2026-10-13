import { useEffect, useRef } from "react";
import { ROUNDING_FOOTNOTE } from "../../viewmodels/format";
import type { ExplainView } from "../../viewmodels/explain";

/**
 * A native modal dialog: the browser traps focus inside it, makes the page behind inert, closes it on Escape,
 * and returns focus to the button that opened it.
 */
export default function ExplainPanel({
  view,
  onClose,
}: {
  view: ExplainView;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="explain"
      aria-labelledby="explain-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
    >
      <div className="explain-body stack">
        <h2 id="explain-title">{view.title}</h2>
        <section className="stack">
          <h3>How this is calculated</h3>
          <p>{view.formula}</p>
        </section>
        <section className="stack">
          <h3>Inputs</h3>
          <ul>
            {view.inputs.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
        <section className="stack">
          <h3>Assumptions used</h3>
          <ul>
            {view.assumptions.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <dl className="values">
            {view.values.map((v) => (
              <div key={v.label}>
                <dt>{v.label}</dt>
                <dd>{v.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <p className="hint">{ROUNDING_FOOTNOTE}</p>
        <button type="button" className="btn btn-primary" onClick={() => ref.current?.close()}>
          Close
        </button>
      </div>
    </dialog>
  );
}
