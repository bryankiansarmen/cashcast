import { describe, expect, it } from "vitest";
import { generateHistorySample } from "../../src/sample/history-sample";
import { initialState, reducer, type Action, type State } from "../../src/state/store";
import { buildAssumptionsView } from "../../src/viewmodels/assumptions-view";
import { percentInputText } from "../../src/viewmodels/format";

const run = (state: State, ...actions: Action[]) => actions.reduce(reducer, state);
const base = initialState();

describe("setCurve", () => {
  it("applies a valid edit (percent text becomes a ratio) and leaves other curves alone", () => {
    const s = run(base, { type: "setCurve", bucket: "current", index: 0, text: "30" });
    expect(s.assumptions.curves.current[0]).toBe(0.3);
    expect(s.assumptions.curves.current.slice(1)).toEqual(base.assumptions.curves.current.slice(1));
    expect(s.assumptions.curves.d1_30).toBe(base.assumptions.curves.d1_30);
    expect(s.assumptionErrors).toEqual({});
  });

  it("accepts two decimals", () => {
    expect(
      run(base, { type: "setCurve", bucket: "current", index: 8, text: "0.25" }).assumptions.curves
        .current[8],
    ).toBe(0.0025);
  });

  it("rejects an edit that pushes the curve past 100%, keeps the old value, and records a message", () => {
    const s = run(base, { type: "setCurve", bucket: "current", index: 0, text: "50" }); // 91% - 40% + 50% = 101%
    expect(s.assumptions).toBe(base.assumptions);
    expect(s.assumptionErrors["curve.current.0"]).toMatch(
      /add up to 101\.0%; the total must be at most 100%/,
    );
  });

  it.each(["", "abc", "-5", "101", "1e1", "12.345", "5%", " "])(
    "rejects %j as not a number from 0 to 100",
    (text) => {
      const s = run(base, { type: "setCurve", bucket: "d1_30", index: 3, text });
      expect(s.assumptions).toBe(base.assumptions);
      expect(s.assumptionErrors["curve.d1_30.3"]).toBe("Enter a number from 0 to 100.");
    },
  );

  it("clears the message when a later edit to the same field is valid", () => {
    const s = run(
      base,
      { type: "setCurve", bucket: "current", index: 0, text: "50" },
      { type: "setCurve", bucket: "current", index: 0, text: "35" },
    );
    expect(s.assumptionErrors).toEqual({});
    expect(s.assumptions.curves.current[0]).toBe(0.35);
  });

  it("keeps messages for other fields independent", () => {
    const s = run(
      base,
      { type: "setCurve", bucket: "current", index: 0, text: "x" },
      { type: "setCurve", bucket: "d1_30", index: 0, text: "20" },
    );
    expect(Object.keys(s.assumptionErrors)).toEqual(["curve.current.0"]);
  });
});

describe("setScenarioParams", () => {
  it("applies valid factor and delay edits", () => {
    const s = run(
      base,
      { type: "setScenarioParams", scenario: "worst", field: "factor", text: "0.7" },
      { type: "setScenarioParams", scenario: "worst", field: "extraDelayWeeks", text: "3" },
    );
    expect(s.assumptions.scenarios.worst).toEqual({ factor: 0.7, extraDelayWeeks: 3 });
    expect(s.assumptionErrors).toEqual({});
  });

  it("rejects an edit that breaks scenario ordering, with the reason", () => {
    const s = run(base, {
      type: "setScenarioParams",
      scenario: "worst",
      field: "factor",
      text: "1.05",
    });
    expect(s.assumptions).toBe(base.assumptions);
    expect(s.assumptionErrors["scenario.worst.factor"]).toMatch(/best ≥ expected ≥ worst/);
  });

  it.each([
    ["factor", "1.6", /best factor|between 0.5 and 1.5/],
    ["factor", "abc", /Enter a number/],
    ["factor", "", /Enter a number/],
    ["extraDelayWeeks", "5", /0 to 4/],
    ["extraDelayWeeks", "1.5", /whole number/],
    ["extraDelayWeeks", "-1", /whole number/],
  ] as const)("rejects %s %j", (field, text, message) => {
    const s = run(base, { type: "setScenarioParams", scenario: "best", field, text });
    expect(s.assumptions).toBe(base.assumptions);
    expect(s.assumptionErrors[`scenario.best.${field}`]).toMatch(message);
  });
});

describe("setCustomer", () => {
  it("sets a delay override and a reliability percent", () => {
    const s = run(
      base,
      { type: "setCustomer", key: "acme", field: "delayWeeks", text: "3" },
      { type: "setCustomer", key: "acme", field: "reliability", text: "90" },
    );
    expect(s.assumptions.customers.acme).toEqual({ delayWeeks: 3, reliability: 0.9 });
  });

  it("clearing a field removes the override, and an empty entry disappears", () => {
    const set = run(
      base,
      { type: "setCustomer", key: "acme", field: "delayWeeks", text: "3" },
      { type: "setCustomer", key: "acme", field: "reliability", text: "50" },
    );
    const one = run(set, { type: "setCustomer", key: "acme", field: "delayWeeks", text: "" });
    expect(one.assumptions.customers.acme).toEqual({ reliability: 0.5 });
    const none = run(one, { type: "setCustomer", key: "acme", field: "reliability", text: "  " });
    expect(none.assumptions.customers).toEqual({});
  });

  it.each([
    ["delayWeeks", "9", /0 to 8/],
    ["delayWeeks", "1.5", /whole number/],
    ["delayWeeks", "abc", /whole number/],
    ["reliability", "110", /0 to 100/],
    ["reliability", "x", /0 to 100/],
  ] as const)("rejects %s %j and keeps the old assumptions", (field, text, message) => {
    const s = run(base, { type: "setCustomer", key: "acme", field, text });
    expect(s.assumptions).toBe(base.assumptions);
    expect(s.assumptionErrors[`customer.acme.${field}`]).toMatch(message);
  });
});

describe("resetAssumptions and related actions", () => {
  it("restores the defaults and clears messages, leaving the dataset alone", () => {
    const dirty = run(
      base,
      { type: "setCurve", bucket: "current", index: 0, text: "30" },
      { type: "setCustomer", key: "a", field: "delayWeeks", text: "2" },
      { type: "setCurve", bucket: "d1_30", index: 0, text: "zzz" },
    );
    const s = run(dirty, { type: "resetAssumptions" });
    expect(s.assumptions).toEqual(base.assumptions);
    expect(s.assumptionErrors).toEqual({});
    expect(s.invoices).toBe(base.invoices);
  });

  it("loading the sample keeps edited assumptions", () => {
    const edited = run(base, { type: "setCurve", bucket: "current", index: 0, text: "30" });
    expect(run(edited, { type: "loadSample" }).assumptions).toBe(edited.assumptions);
  });

  it("storageFailed sets the flag once and is otherwise a no-op", () => {
    const s = run(base, { type: "storageFailed" });
    expect(s.storageUnavailable).toBe(true);
    expect(reducer(s, { type: "storageFailed" })).toBe(s);
  });

  it("does not mutate the previous state", () => {
    const snapshot = structuredClone(base);
    run(
      base,
      { type: "setCurve", bucket: "current", index: 0, text: "30" },
      { type: "setCustomer", key: "a", field: "delayWeeks", text: "2" },
      { type: "setScenarioParams", scenario: "best", field: "factor", text: "1.2" },
    );
    expect(base).toEqual(snapshot);
  });
});

describe("buildAssumptionsView", () => {
  const view = buildAssumptionsView(base.assumptions, base.invoices, []);

  it("shows curves as percent text with a live one-decimal sum", () => {
    expect(view.curves.map((c) => c.label)).toEqual(["Current", "1–30", "31–60", "61–90", "91+"]);
    expect(view.curves[0].values).toEqual([
      "40",
      "20",
      "12",
      "8",
      "5",
      "3",
      "2",
      "1",
      "0",
      "0",
      "0",
      "0",
      "0",
    ]);
    expect(view.curves.map((c) => c.sum)).toEqual(["91.0%", "81.0%", "65.0%", "46.0%", "23.0%"]);
  });

  it("updates the sum as a curve is edited", () => {
    const s = run(base, { type: "setCurve", bucket: "current", index: 0, text: "30" });
    expect(buildAssumptionsView(s.assumptions, s.invoices, []).curves[0].sum).toBe("81.0%");
  });

  it("shows scenario parameters", () => {
    expect(view.scenarios).toEqual([
      { id: "best", label: "Best", factor: "1.1", extraDelayWeeks: "0" },
      { id: "expected", label: "Expected", factor: "1", extraDelayWeeks: "0" },
      { id: "worst", label: "Worst", factor: "0.8", extraDelayWeeks: "2" },
    ]);
  });

  it("lists every invoice customer once, with no history noted", () => {
    expect(view.customers).toHaveLength(12);
    expect(
      view.customers.every((c) => c.derivedNote === "No payment history" && c.delayText === ""),
    ).toBe(true);
  });

  it("labels derived delays and insufficient history, and shows manual overrides separately", () => {
    const manual = run(
      base,
      { type: "setCustomer", key: "alder & pine llc", field: "delayWeeks", text: "1" },
      { type: "setCustomer", key: "alder & pine llc", field: "reliability", text: "75" },
    );
    const v = buildAssumptionsView(manual.assumptions, manual.invoices, generateHistorySample());
    const row = (name: string) => v.customers.find((c) => c.name === name)!;
    expect(row("Granite Peak Builders").derivedNote).toBe("8 weeks, derived from 7 paid invoices");
    expect(row("Kestrel Freight").derivedNote).toBe("2 weeks, derived from 5 paid invoices");
    expect(row("Juniper Bay Clinic").derivedNote).toBe(
      "Insufficient history (1 paid invoice; 3 needed)",
    );
    expect(row("Lantern Hill Studio").derivedNote).toBe(
      "Insufficient history (2 paid invoices; 3 needed)",
    );
    expect(row("Alder & Pine LLC")).toMatchObject({
      derivedNote: "3 weeks, derived from 6 paid invoices",
      delayText: "1",
      reliabilityText: "75",
    });
    expect(row("Granite Peak Builders").delayText).toBe("");
  });
});

describe("percentInputText", () => {
  it.each([
    [0.4, "40"],
    [0.07, "7"],
    [0.125, "12.5"],
    [0.0025, "0.25"],
    [0, "0"],
    [1, "100"],
    [0.30000000000000004, "30"],
  ])("%d is %s", (ratio, text) => expect(percentInputText(ratio)).toBe(text));
});
