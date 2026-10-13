import { fileURLToPath } from "node:url";
import { expect, test } from "../support/test";

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const KEY = "cashcast.assumptions.v1";

const collected = (page: import("@playwright/test").Page) =>
  page.locator(".metric", { hasText: "Expected collections, 13 weeks" }).locator(".metric-value");
const cell = (page: import("@playwright/test").Page, label: string) =>
  page.getByLabel(label, { exact: true });
const stored = (page: import("@playwright/test").Page) =>
  page.evaluate((k) => localStorage.getItem(k), KEY);

test("a valid curve edit recomputes the forecast, persists across reloads, and reset restores the defaults", async ({
  page,
}) => {
  await page.goto("/");
  const before = await collected(page).textContent();
  const week1 = cell(page, "Current curve, week 1 (%)");
  await expect(week1).toHaveValue("40");
  await expect(page.getByLabel("Current curve total")).toHaveText("91.0%");
  expect(await stored(page)).toBeNull();

  await week1.fill("30");
  await expect(page.getByLabel("Current curve total")).toHaveText("81.0%");
  await expect(collected(page)).not.toHaveText(before!);
  const edited = await collected(page).textContent();
  expect(await stored(page)).not.toBeNull();

  await page.reload();
  await expect(cell(page, "Current curve, week 1 (%)")).toHaveValue("30");
  await expect(collected(page)).toHaveText(edited!);
  await expect(page.getByText("Illustrative default assumptions")).toHaveCount(0); // edited, so no longer the defaults

  await page.getByRole("button", { name: "Reset assumptions to defaults" }).click();
  await expect(cell(page, "Current curve, week 1 (%)")).toHaveValue("40");
  await expect(collected(page)).toHaveText(before!);
  await expect(page.getByText("Illustrative default assumptions")).toBeVisible();
  expect(await stored(page)).toBeNull();
});

test("an invalid edit shows an inline message tied to the field and is not applied", async ({
  page,
}) => {
  await page.goto("/");
  const before = await collected(page).textContent();
  const week1 = cell(page, "Current curve, week 1 (%)");
  await week1.fill("50"); // the curve would add up to 101%
  await expect(week1).toHaveAttribute("aria-invalid", "true");
  const describedBy = await week1.getAttribute("aria-describedby");
  expect(describedBy).toBe("err-curve.current.0");
  await expect(page.locator(`[id="${describedBy}"]`)).toContainText(
    "add up to 101.0%; the total must be at most 100%",
  );
  await expect(week1).toHaveValue("50"); // what was typed stays visible
  await expect(collected(page)).toHaveText(before!);
  expect(await stored(page)).toBeNull();

  await week1.fill("35");
  await expect(week1).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(`[id="${describedBy}"]`)).toHaveCount(0);
  await expect(collected(page)).not.toHaveText(before!);
});

test("text that is not a number is rejected with a message", async ({ page }) => {
  await page.goto("/");
  const week1 = cell(page, "Current curve, week 1 (%)");
  await week1.fill("abc");
  await expect(
    page.getByRole("alert").filter({ hasText: "Enter a number from 0 to 100." }),
  ).toBeVisible();
});

test("a scenario edit that breaks the ordering is rejected with the reason", async ({ page }) => {
  await page.goto("/");
  await cell(page, "Worst collection factor").fill("1.2");
  await expect(
    page.getByRole("alert").filter({ hasText: "best ≥ expected ≥ worst" }),
  ).toBeVisible();
  await expect(cell(page, "Worst collection factor")).toHaveAttribute("aria-invalid", "true");
});

test("derived customer delays are labelled and a manual override changes the forecast", async ({
  page,
}) => {
  await page.goto("/");
  // The customer also appears in the aging table, so look only inside the adjustments table.
  const adjustments = page.getByRole("region", { name: "Customer adjustments" });
  const row = (name: string) => adjustments.getByRole("row", { name: new RegExp(name) });
  await expect(row("Granite Peak Builders")).toContainText("No payment history");
  await page
    .getByTestId("file-Payment history CSV (optional)")
    .setInputFiles(fixture("history-sample.csv"));
  await expect(row("Granite Peak Builders")).toContainText("8 weeks, derived from 7 paid invoices");
  await expect(row("Juniper Bay Clinic")).toContainText(
    "Insufficient history (1 paid invoice; 3 needed)",
  );

  const derivedOnly = await collected(page).textContent();
  await cell(page, "Granite Peak Builders delay override in weeks").fill("0");
  await expect(collected(page)).not.toHaveText(derivedOnly!);
  await expect(row("Granite Peak Builders")).toContainText("8 weeks, derived"); // still shows what the history says
});

test("stored data that is unreadable or invalid falls back to the defaults without an error", async ({
  page,
}) => {
  for (const junk of [
    "{not json",
    JSON.stringify({ version: 1, curves: {}, scenarios: {}, customers: {} }),
  ]) {
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [KEY, junk]);
    await page.goto("/");
    await expect(cell(page, "Current curve, week 1 (%)")).toHaveValue("40");
    await expect(page.getByText("Illustrative default assumptions")).toBeVisible();
    await expect(page.getByText("blocking storage")).toHaveCount(0);
  }
});

test("blocked storage keeps the app working and says edits will not be saved", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("blocked");
      },
    });
  });
  await page.goto("/");
  await expect(page.getByText("Your browser is blocking storage")).toBeVisible();
  const before = await collected(page).textContent();
  await cell(page, "Current curve, week 1 (%)").fill("30");
  await expect(collected(page)).not.toHaveText(before!);
  await page.getByRole("button", { name: "Dismiss" }).first().click();
  await page.getByRole("button", { name: "Switch to dark theme" }).click(); // theme still works for the session
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
