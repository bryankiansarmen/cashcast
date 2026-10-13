import { expect, test } from "../support/test";

// Every kind of number on the page must be reachable through an explain button (INV-07).
const EXPECTED_IDS = [
  "aging.bucketCount",
  "aging.bucketShare",
  "aging.bucketTotal",
  "aging.customerBucket",
  "aging.customerTotal",
  "aging.pastDue",
  "aging.totalOpen",
  "assumptions.curveTotal",
  "forecast.collected13",
  "forecast.next4",
  "forecast.uncollected",
  "forecast.weekCumulative",
  "forecast.weekInflow",
  "reconciliation.status",
];

test("every kind of number has an explain button, and each opens a complete panel that Escape closes", async ({
  page,
}) => {
  await page.goto("/");
  const triggers = page.locator("[data-explain-id]");
  const ids = await triggers.evaluateAll((els) =>
    [...new Set(els.map((e) => e.getAttribute("data-explain-id")))].sort(),
  );
  expect(ids).toEqual(EXPECTED_IDS);

  const count = await triggers.count();
  expect(count).toBeGreaterThanOrEqual(EXPECTED_IDS.length);
  const dialog = page.getByRole("dialog");
  for (let i = 0; i < count; i++) {
    const trigger = triggers.nth(i);
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { level: 2 })).not.toBeEmpty();
    for (const heading of ["How this is calculated", "Inputs", "Assumptions used"]) {
      await expect(dialog.getByRole("heading", { name: heading })).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused(); // focus returns to the button that opened it
  }
});

test("the panel shows the formula and the assumption values in use", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-explain-id="forecast.collected13"]').click();
  const dialog = page.getByRole("dialog", { name: "Expected collections, 13 weeks" });
  await expect(dialog).toContainText("scale = min(reliability × factor, 1 / curveSum)");
  await expect(dialog).toContainText("startWeek + k + delay");
  await expect(dialog).toContainText("As-of date");
  await expect(dialog).toContainText("2026-09-30");
  await expect(dialog).toContainText("Expected: factor 1, extra delay 0 weeks");
  await expect(dialog).toContainText(
    "Current 91.0%, 1–30 81.0%, 31–60 65.0%, 61–90 46.0%, 91+ 23.0%",
  );
  await expect(dialog).toContainText("Illustrative defaults, not industry benchmarks");
  await expect(dialog).toContainText("Dollars are rounded to whole dollars");
});

test("the values follow edited assumptions and the selected scenario", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Current curve, week 1 (%)", { exact: true }).fill("30");
  await page.locator("label.segment", { hasText: "Worst" }).click();
  await page.locator('[data-explain-id="forecast.weekInflow"]').click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Worst: factor 0.8, extra delay 2 weeks");
  await expect(dialog).toContainText("Current 81.0%");
  await expect(dialog).toContainText("Edited by you");
});

test("focus stays inside the open panel, and Close and the backdrop dismiss it", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.locator('[data-explain-id="aging.totalOpen"]');
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused(); // focus moves into the panel
  // The page behind is inert: focus may only be in the panel (or on the document when the browser has no chrome to cycle to).
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => {
        const a = document.activeElement;
        return !a || a === document.body || !!a.closest("dialog");
      }),
    ).toBe(true);
  }
  await page.keyboard.press("Shift+Tab");
  await dialog.getByRole("button", { name: "Close" }).focus();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(5, 5); // on the backdrop, outside the panel
  await expect(dialog).toHaveCount(0);
});
