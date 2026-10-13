import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { expect, test } from "../support/test";

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

/** WCAG 2.2 AA plus axe's best-practice rules: zero serious or critical findings (DESIGN_SYSTEM.md, Accessibility). */
async function expectNoSeriousViolations(page: Page, state: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  // A scan that checked nothing would pass too, so make sure the key rules really ran. With a modal panel open the
  // page behind it is inert, so form-label and landmark rules have nothing to check and are not required then.
  const ran = new Set([...results.passes, ...results.violations].map((r) => r.id));
  const modal = state.includes("explain panel");
  const required = [
    "color-contrast",
    "button-name",
    "aria-valid-attr-value",
    ...(modal ? [] : ["label", "landmark-one-main"]),
  ];
  for (const rule of required) {
    expect(ran.has(rule), `axe did not run ${rule}: ${state}`).toBe(true);
  }
  const serious = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(" "))
          .join(" | ")}`,
    );
  expect(serious, `axe findings: ${state}`).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`axe, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test("Forecast page: default, explain panel open, and error states", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator(".metric-value").first()).toBeVisible();
      await expectNoSeriousViolations(page, "forecast, default");

      await page.locator('[data-explain-id="forecast.collected13"]').click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expectNoSeriousViolations(page, "forecast, explain panel open");
      await page.keyboard.press("Escape");

      await page.getByLabel("Current curve, week 1 (%)", { exact: true }).fill("50"); // invalid: the curve would pass 100%
      await expect(page.getByRole("alert").filter({ hasText: "add up to" })).toBeVisible();
      await page.getByTestId("file-AR aging CSV").setInputFiles(fixture("ar-malformed.csv"));
      await expect(page.getByRole("region", { name: "Import errors" })).toBeVisible();
      await expectNoSeriousViolations(page, "forecast, invalid edit and failed import");
    });

    test("Budget page: default, expanded contributors, explain panel, and error states", async ({
      page,
    }) => {
      await page.goto("/#/budget");
      await expect(page.locator(".metric-value").first()).toBeVisible();
      await expectNoSeriousViolations(page, "budget, default");

      await page.locator("details summary").first().click();
      await page.locator('[data-explain-id="budget.categoryStatus"]').click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expectNoSeriousViolations(page, "budget, details and explain panel open");
      await page.keyboard.press("Escape");

      await page.getByLabel("Travel monthly target in dollars").fill("abc");
      await page.getByLabel("Rule 1: description contains").fill("");
      await page.getByRole("button", { name: "Add rule" }).click();
      await page
        .getByTestId("file-Transactions CSV")
        .setInputFiles(fixture("transactions-malformed.csv"));
      await expect(page.getByRole("region", { name: "Import errors" })).toBeVisible();
      await expectNoSeriousViolations(page, "budget, invalid edits and failed import");
    });
  });
}

test.describe("keyboard", () => {
  async function stops(page: Page, max = 400) {
    const list: {
      desc: string;
      visibleFocus: boolean;
      tabindex: string | null;
      position: number;
    }[] = [];
    let previous: string | null = null;
    for (let i = 0; i < max; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const style = (e: Element) => getComputedStyle(e);
        const own = style(el);
        // Radios are visually hidden; their label shows the focus ring.
        const holder = el.matches("input[type=radio]") ? (el.closest("label") ?? el) : el;
        const s = holder === el ? own : style(holder);
        const width = parseFloat(s.outlineWidth);
        const visibleFocus =
          s.outlineStyle !== "none" && width >= 2 && s.outlineColor !== "rgba(0, 0, 0, 0)";
        const all = [...document.querySelectorAll("*")];
        return {
          desc: `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label")}]` : ""}${el.textContent ? `:${el.textContent.trim().slice(0, 30)}` : ""}`,
          visibleFocus,
          tabindex: el.getAttribute("tabindex"),
          position: all.indexOf(el),
        };
      });
      if (info === null) break; // focus left the page content
      if (info.desc === previous && list.length > 0 && list.at(-1)!.position === info.position)
        break;
      previous = info.desc;
      list.push(info);
    }
    return list;
  }

  for (const route of ["/", "/#/budget"]) {
    test(`Tab through ${route}: every stop has a visible focus ring and the order follows the page`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page.locator(".metric-value").first()).toBeVisible();
      const list = await stops(page);
      expect(list.length).toBeGreaterThan(25);

      const noRing = list.filter((s) => !s.visibleFocus).map((s) => s.desc);
      expect(noRing, "stops without a visible focus ring").toEqual([]);

      const positive = list
        .filter((s) => s.tabindex !== null && Number(s.tabindex) > 0)
        .map((s) => s.desc);
      expect(positive, "positive tabindex values reorder focus").toEqual([]);

      const positions = list.map((s) => s.position);
      expect(positions, "focus order follows document order").toEqual(
        [...positions].sort((a, b) => a - b),
      );
      expect(new Set(positions).size).toBe(positions.length); // no stop is visited twice

      // The header controls come first, in order.
      expect(list[0].desc).toContain("Forecast");
      expect(list[1].desc).toContain("Budget");
      expect(list[2].desc).toContain("dark theme");
    });
  }

  test("Shift+Tab walks back to the previous stop", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".metric-value").first()).toBeVisible(); // keys pressed before the app renders go nowhere
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Budget" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("link", { name: "Forecast" })).toBeFocused();
  });
});

test("the chart's table alternative carries the same weekly figures as the chart summary", async ({
  page,
}) => {
  await page.goto("/");
  const summary = (await page
    .getByRole("img", { name: /Cumulative collections over 13 weeks/ })
    .getAttribute("aria-label"))!;
  const money = (label: string) =>
    new RegExp(`${label} (-?\\$\\d{1,3}(?:,\\d{3})*)`).exec(summary)![1];

  const table = page.getByRole("region", { name: "Weekly forecast" });
  const rows = table.getByRole("row");
  await expect(rows).toHaveCount(14); // header plus 13 weeks, none hidden from assistive technology
  const last = rows.nth(13).getByRole("cell");
  const cells = await last.allTextContents();
  // Week, Starts, Ends, Collections, Cumulative best, Cumulative expected, Cumulative worst
  expect(cells[0]).toBe("W13");
  expect(cells[4]).toBe(money("best"));
  expect(cells[5]).toBe(money("expected"));
  expect(cells[6]).toBe(money("worst"));
  await expect(
    page.locator(".metric", { hasText: "Expected collections, 13 weeks" }).locator(".metric-value"),
  ).toHaveText(money("expected"));

  // Every week of the chart is in the table, in order.
  const weeks = await rows.locator("td:first-child").allTextContents();
  expect(weeks).toEqual(Array.from({ length: 13 }, (_, i) => `W${i + 1}`));
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("a reduced-motion preference leaves no animation or transition running", async ({
    page,
  }) => {
    await page.goto("/");
    await page.goto("/#/budget");
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
      true,
    );
    const motion = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          "body, button, a, input, select, .card, .badge, details, summary, th",
        ),
      ].map((el) => {
        const s = getComputedStyle(el);
        return {
          tag: el.tagName,
          animation: s.animationName,
          transition: s.transitionDuration,
          anim: s.animationDuration,
        };
      }),
    );
    expect(motion.length).toBeGreaterThan(20);
    for (const m of motion) {
      expect(m.animation, `animation on ${m.tag}`).toBe("none");
      expect(
        m.transition.split(",").every((d) => parseFloat(d) === 0),
        `transition on ${m.tag}`,
      ).toBe(true);
    }
    await page.goto("/");
    expect(await page.locator(".recharts-line-curve").count()).toBe(3); // the chart is drawn at once, not animated in
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });
});

// Responsive pass: three widths, both themes, both pages.
for (const width of [360, 768, 1280]) {
  for (const scheme of ["light", "dark"] as const) {
    test.describe(`layout at ${width}px, ${scheme} theme`, () => {
      test.use({ colorScheme: scheme, viewport: { width, height: 800 } });

      for (const [name, route] of [
        ["Forecast", "/"],
        ["Budget", "/#/budget"],
      ] as const) {
        test(`${name} page fits the screen, scrolls wide tables inside their own containers, and has 44 px targets`, async ({
          page,
        }) => {
          await page.goto(route);
          await expect(page.locator(".metric-value").first()).toBeVisible();

          const layout = await page.evaluate(() => {
            const root = document.documentElement;
            const containers = [...document.querySelectorAll<HTMLElement>(".table-scroll, .chart")];
            return {
              pageOverflow: root.scrollWidth - root.clientWidth,
              leaking: containers
                .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
                .map((el) => el.className),
              unscrollable: containers
                .filter(
                  (el) =>
                    el.scrollWidth > el.clientWidth + 1 &&
                    !["auto", "scroll"].includes(getComputedStyle(el).overflowX),
                )
                .map((el) => el.className),
              scrolling: containers.filter((el) => el.scrollWidth > el.clientWidth + 1).length,
            };
          });
          expect(layout.pageOverflow, "the page itself scrolls sideways").toBeLessThanOrEqual(0);
          expect(layout.leaking, "containers wider than the screen").toEqual([]);
          expect(layout.unscrollable, "overflowing content with no scrolling container").toEqual(
            [],
          );
          if (width === 360)
            expect(layout.scrolling, "wide tables scroll inside their containers").toBeGreaterThan(
              0,
            );

          const small = await page.evaluate(() => {
            const selector =
              'button, a[href], select, summary, label.segment, input:not([type="hidden"]):not([type="file"]):not([type="radio"])';
            return [...document.querySelectorAll<HTMLElement>(selector)]
              .filter((el) => {
                const r = el.getBoundingClientRect();
                const s = getComputedStyle(el);
                return (
                  s.visibility !== "hidden" &&
                  s.display !== "none" &&
                  r.width > 0 &&
                  r.height > 0 &&
                  !el.closest("[hidden]")
                );
              })
              .map((el) => {
                const r = el.getBoundingClientRect();
                const label =
                  el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 24) ?? "";
                return {
                  target: `${el.tagName.toLowerCase()} ${label}`,
                  w: Math.round(r.width),
                  h: Math.round(r.height),
                };
              })
              .filter((t) => Math.min(t.w, t.h) < 44);
          });
          expect(small, "touch targets under 44 by 44 px").toEqual([]);

          await expectNoSeriousViolations(page, `${name} at ${width}px, ${scheme}`);
        });
      }
    });
  }
}

for (const width of [360, 768, 1280]) {
  test.describe(`chart key, week table, and cards at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("the chart key sits below the plot, and the week table shows all 13 weeks without a scroll box", async ({
      page,
    }) => {
      await page.goto("/");
      const chart = page.locator(".chart");
      const legend = page.locator(".chart-legend");
      await expect(legend.getByRole("listitem")).toHaveText([
        "Weekly collections (expected)",
        "Cumulative expected",
        "Cumulative best",
        "Cumulative worst",
      ]);
      const [c, l] = await Promise.all([chart.boundingBox(), legend.boundingBox()]);
      expect(l!.y, "the key starts below the chart").toBeGreaterThanOrEqual(c!.y + c!.height - 1);

      const table = page.getByRole("region", { name: "Weekly forecast" });
      const box = await table.evaluate((el) => ({
        scroll: el.scrollHeight,
        client: el.clientHeight,
      }));
      expect(box.scroll, "the week table has its own vertical scrolling").toBeLessThanOrEqual(
        box.client + 1,
      );
      await expect(table.getByRole("row").last()).toContainText("W13");
    });

    test("the Budget summary cards share one row on a wide screen", async ({ page }) => {
      await page.goto("/#/budget");
      const tops = await page
        .locator(".metric")
        .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
      expect(tops).toHaveLength(5);
      if (width >= 1024) expect(new Set(tops).size, "five cards in one row").toBe(1);
      else
        expect(new Set(tops).size, "cards stack or wrap on a narrower screen").toBeGreaterThan(1);
    });
  });
}
