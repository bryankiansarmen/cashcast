import { describe, expect, it } from "vitest";
import { agingSummary, BUCKET_IDS, classify } from "../../src/engine/aging";
import { generateArSample, SAMPLE_CUSTOMERS } from "../../src/sample/ar-sample";
import { SAMPLE_AS_OF } from "../../src/sample/constants";
import { mulberry32, randInt } from "../../src/sample/prng";

describe("mulberry32", () => {
  it("is deterministic for a seed and differs across seeds", () => {
    const seq = (seed: number) => {
      const r = mulberry32(seed);
      return [r(), r(), r()];
    };
    expect(seq(1)).toEqual(seq(1));
    expect(seq(1)).not.toEqual(seq(2));
  });

  it("returns values in [0, 1) and randInt stays within inclusive bounds", () => {
    const r = mulberry32(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      seen.add(randInt(r, 3, 6));
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });
});

describe("generateArSample", () => {
  const sample = generateArSample();

  it("uses the fixed as-of date", () => {
    expect(SAMPLE_AS_OF).toBe("2026-09-30");
  });

  it("returns deeply equal output on repeated calls", () => {
    expect(generateArSample()).toEqual(sample);
  });

  it("matches the recorded literal count and total", () => {
    expect(sample).toHaveLength(60);
    expect(sample.reduce((s, i) => s + i.openCents, 0)).toBe(153_453_445); // $1,534,534.45; changing the generator requires re-recording this;
  });

  it("has at least 3 invoices in each of the five buckets", () => {
    const counts = agingSummary(sample, SAMPLE_AS_OF).buckets;
    for (const b of BUCKET_IDS) expect(counts[b].count).toBeGreaterThanOrEqual(3);
    expect(sample.map((i) => classify(i, SAMPLE_AS_OF).bucket)).toContain("d91_plus");
  });

  it("keeps amounts between $1,200 and $48,000 as integer cents", () => {
    for (const i of sample) {
      expect(Number.isInteger(i.openCents)).toBe(true);
      expect(i.openCents).toBeGreaterThanOrEqual(120_000);
      expect(i.openCents).toBeLessThanOrEqual(4_800_099);
    }
  });

  it("covers all twelve fictional customers with consistent keys", () => {
    expect(new Set(sample.map((i) => i.customerName))).toEqual(new Set(SAMPLE_CUSTOMERS));
    for (const i of sample) expect(i.customerKey).toBe(i.customerName.toLowerCase());
  });

  it("has unique ids and invoice numbers and no invoice dated after as-of", () => {
    expect(new Set(sample.map((i) => i.id)).size).toBe(60);
    expect(new Set(sample.map((i) => i.invoiceNumber)).size).toBe(60);
    for (const i of sample) expect(i.invoiceDate! <= SAMPLE_AS_OF).toBe(true);
  });
});
