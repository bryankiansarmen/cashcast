import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Vitest blanks CSS imports (including ?raw), so read the source file directly.
const css = readFileSync(new URL("../../src/ui/styles/tokens.css", import.meta.url), "utf8");

// Colour declarations of the block that starts at `marker`.
const palette = (marker: string): Record<string, string> => {
  const start = css.indexOf(marker);
  if (start < 0) throw new Error(`tokens.css has no block "${marker}"`);
  const block = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
  );
};

const channel = (hex: string, i: number) => {
  const c = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) =>
  0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const themes = {
  light: palette(":root {"),
  dark: palette(':root[data-theme="dark"] {'),
};

describe("tokens.css", () => {
  it("defines every colour token in both themes", () => {
    const names = [
      "bg",
      "surface",
      "text",
      "muted",
      "border",
      "accent",
      "accent-contrast",
      "good",
      "warn",
      "bad",
    ];
    for (const t of Object.values(themes)) expect(Object.keys(t).sort()).toEqual([...names].sort());
  });

  it("keeps the system-dark copy identical to the explicit dark palette", () => {
    expect(palette(':root:not([data-theme="light"]) {')).toEqual(themes.dark);
  });

  const textTokens = ["text", "muted", "accent", "good", "warn", "bad"];
  describe.each(Object.entries(themes))("%s theme contrast", (_name, p) => {
    it.each(textTokens.flatMap((t) => ["bg", "surface"].map((bg) => [t, bg])))(
      "%s on %s is at least 4.5:1",
      (t, bg) => {
        expect(contrast(p[t], p[bg])).toBeGreaterThanOrEqual(4.5);
      },
    );

    it("accent-contrast on accent is at least 4.5:1", () => {
      expect(contrast(p["accent-contrast"], p.accent)).toBeGreaterThanOrEqual(4.5);
    });

    it("muted text on accent-free surfaces and accent tab text both pass (tab text is muted on surface)", () => {
      expect(contrast(p.muted, p.surface)).toBeGreaterThanOrEqual(4.5);
    });
  });
});
