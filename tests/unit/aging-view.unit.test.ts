import { describe, expect, it } from "vitest";
import { agingSummary, BUCKET_IDS } from "../../src/engine/aging";
import { generateArSample } from "../../src/sample/ar-sample";
import { SAMPLE_AS_OF } from "../../src/sample/constants";
import { AGING_EXPLAIN_IDS, BUCKET_LABELS, buildAgingView } from "../../src/viewmodels/aging-view";
import { formatPercent } from "../../src/viewmodels/format";

const sample = generateArSample();
const view = buildAgingView(sample, SAMPLE_AS_OF);
const engine = agingSummary(sample, SAMPLE_AS_OF);

describe("buildAgingView", () => {
  it("displayed bucket totals and counts equal the engine totals", () => {
    expect(view.totalOpenCents).toBe(engine.totalCents);
    expect(view.totalOpenCents).toBe(153_453_445); // the recorded sample total
    for (const row of view.buckets) {
      expect(row.totalCents).toBe(engine.buckets[row.id].totalCents);
      expect(row.count).toBe(engine.buckets[row.id].count);
    }
    expect(view.buckets.reduce((s, b) => s + b.totalCents, 0)).toBe(view.totalOpenCents);
  });

  it("lists the five buckets in order with their labels", () => {
    expect(view.buckets.map((b) => b.id)).toEqual([...BUCKET_IDS]);
    expect(view.buckets.map((b) => b.label)).toEqual(["Current", "1–30", "31–60", "61–90", "91+"]);
    expect(BUCKET_LABELS.d91_plus).toBe("91+");
    expect(view.buckets.map((b) => b.count)).toEqual([24, 14, 10, 7, 5]);
  });

  it("past due is everything except current, and shares are ratios of the total", () => {
    expect(view.pastDueCents).toBe(view.totalOpenCents - view.buckets[0].totalCents);
    expect(view.pastDueShare).toBeCloseTo(view.pastDueCents / view.totalOpenCents, 12);
    expect(view.buckets.reduce((s, b) => s + b.share, 0)).toBeCloseTo(1, 12);
    expect(view.invoiceCount).toBe(60);
    expect(view.customerCount).toBe(12);
    expect(view.asOf).toBe(SAMPLE_AS_OF);
    expect(view.isEmpty).toBe(false);
  });

  it("customers come sorted by total descending with a per-bucket matrix that adds up", () => {
    const totals = view.customers.map((c) => c.totalCents);
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
    for (const c of view.customers) {
      expect(BUCKET_IDS.reduce((s, id) => s + c.byBucketCents[id], 0)).toBe(c.totalCents);
    }
    expect(totals.reduce((a, b) => a + b, 0)).toBe(view.totalOpenCents);
  });

  it("an empty dataset is flagged empty with all zeros and no division error", () => {
    const empty = buildAgingView([], SAMPLE_AS_OF);
    expect(empty.isEmpty).toBe(true);
    expect(empty.totalOpenCents).toBe(0);
    expect(empty.pastDueShare).toBe(0);
    expect(empty.buckets.every((b) => b.totalCents === 0 && b.count === 0 && b.share === 0)).toBe(
      true,
    );
    expect(empty.customers).toEqual([]);
  });

  it("is pure: the same input gives deeply equal output", () => {
    expect(buildAgingView(sample, SAMPLE_AS_OF)).toEqual(view);
  });

  it("names every kind of number it displays so the explain registry can cover them (INV-07)", () => {
    expect(new Set(AGING_EXPLAIN_IDS).size).toBe(AGING_EXPLAIN_IDS.length);
    expect(AGING_EXPLAIN_IDS.every((id) => id.startsWith("aging."))).toBe(true);
  });
});

describe("percentages show one decimal", () => {
  it.each([
    [0.1234, "12.3%"],
    [0.12, "12.0%"],
    [0, "0.0%"],
    [1, "100.0%"],
    [0.0625, "6.3%"], // half rounds up
    [-0.0625, "-6.3%"],
  ])("%d is %s", (ratio, text) => expect(formatPercent(ratio, 1)).toBe(text));

  it("shows the bucket shares with one decimal", () => {
    for (const b of view.buckets) expect(formatPercent(b.share, 1)).toMatch(/^\d+\.\d%$/);
  });
});
