import { expect, test } from "@playwright/test";

const OUT = "docs/screenshots";

test("readme screenshots", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".recharts-line-curve")).toHaveCount(3);
  // From the reconciliation indicator down to the chart key.
  const top = (await page.locator(".recon").boundingBox())!;
  const cards = (await page.locator(".metric-grid").first().boundingBox())!;
  const key = (await page.locator(".chart-legend").boundingBox())!;
  await page.screenshot({
    path: `${OUT}/forecast.png`,
    fullPage: true,
    clip: {
      x: Math.max(0, cards.x - 16),
      y: top.y - 8,
      width: cards.width + 32,
      height: key.y + key.height - top.y + 20,
    },
  });

  // A taller window, so the whole panel fits without scrolling.
  await page.setViewportSize({ width: 1200, height: 1300 });
  await page.locator('[data-explain-id="forecast.collected13"]').click();
  await page.getByRole("dialog").screenshot({ path: `${OUT}/explain.png` });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1200, height: 900 });

  await page.goto("/#/budget");
  await expect(page.getByRole("heading", { name: /Spending against targets/ })).toBeVisible();
  await page
    .getByRole("heading", { name: /Spending against targets/ })
    .locator("xpath=ancestor::section")
    .screenshot({ path: `${OUT}/budget.png` });
});
