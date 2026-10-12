import { fileURLToPath } from "node:url";
import { expect, test } from "../support/test";

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

test("the forecast shows metrics, an illustrative label, the footnote, a labelled chart and a matching table", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Expected collections, 13 weeks")).toBeVisible();
  await expect(page.getByText("Uncollected in horizon")).toBeVisible();
  await expect(page.getByText("Next 4 weeks", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Illustrative default assumptions, not industry benchmarks"),
  ).toBeVisible();
  await expect(page.getByText(/Dollars are rounded to whole dollars/).first()).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Cumulative collections over 13 weeks from 2026-09-30/ }),
  ).toBeVisible();
  const table = page.getByRole("region", { name: "Weekly forecast" });
  await expect(table.getByRole("row")).toHaveCount(14);
  await expect(table.getByRole("row").nth(1)).toContainText("2026-10-01");
  await expect(table.getByRole("row").nth(13)).toContainText("2026-12-30");
});

test("scenario lines differ by style: expected solid, best dashed, worst dotted", async ({
  page,
}) => {
  await page.goto("/");
  const lines = page.locator(".recharts-line-curve");
  await expect(lines).toHaveCount(3);
  const dashes = await lines.evaluateAll((els) =>
    els.map((e) => e.getAttribute("stroke-dasharray")),
  );
  expect(dashes.filter((d) => !d)).toHaveLength(1); // expected: solid
  expect(dashes).toContain("8 4"); // best
  expect(dashes).toContain("2 4"); // worst
});

test("the scenario toggle works with the arrow keys and changes the weekly column only", async ({
  page,
}) => {
  await page.goto("/");
  const metric = page
    .getByText("Expected collections, 13 weeks")
    .locator("xpath=following-sibling::div[1]");
  const before = await metric.textContent();
  const table = page.getByRole("region", { name: "Weekly forecast" });
  await expect(table.getByRole("columnheader", { name: /Collections \(expected\)/ })).toBeVisible();

  const expected = page.getByRole("radio", { name: "Expected" });
  await expect(expected).toBeChecked();
  await expected.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Worst" })).toBeChecked();
  await expect(table.getByRole("columnheader", { name: /Collections \(worst\)/ })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("radio", { name: "Best" })).toBeChecked();
  await expect(table.getByRole("columnheader", { name: /Collections \(best\)/ })).toBeVisible();
  expect(await metric.textContent()).toBe(before);
});

test("importing payment history changes the forecast", async ({ page }) => {
  await page.goto("/");
  const metric = page
    .getByText("Expected collections, 13 weeks")
    .locator("xpath=following-sibling::div[1]");
  const before = await metric.textContent();
  await page
    .getByTestId("file-Payment history CSV (optional)")
    .setInputFiles(fixture("history-sample.csv"));
  await expect(page.getByText("Imported 59 paid invoices")).toBeVisible();
  await expect.poll(async () => metric.textContent()).not.toBe(before);
});
