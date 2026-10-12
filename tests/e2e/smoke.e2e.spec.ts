import { expect, test } from "@playwright/test";

test.use({ colorScheme: "light" });

// Any console error or uncaught exception fails the test that caused it.
const problems: string[] = [];
test.beforeEach(({ page }) => {
  problems.length = 0;
  page.on("console", (m) => m.type() === "error" && problems.push(`console error: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`uncaught: ${e.message}`));
});
test.afterEach(() => {
  expect(problems).toEqual([]);
});

test("app loads on the forecast page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("CashCast", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Forecast" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Forecast" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("tabs switch pages through the URL hash", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Budget" }).click();
  await expect(page).toHaveURL(/#\/budget$/);
  await expect(page.getByRole("heading", { name: "Budget" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Budget" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Forecast" }).click();
  await expect(page).toHaveURL(/#\/forecast$/);
  await expect(page.getByRole("heading", { name: "Forecast" })).toBeVisible();
});

test("a direct visit to #/budget opens the budget page", async ({ page }) => {
  await page.goto("/#/budget");
  await expect(page.getByRole("heading", { name: "Budget" })).toBeVisible();
});

test("theme follows the system and the toggle persists across reloads", async ({ page }) => {
  await page.goto("/");
  const root = page.locator("html");
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await expect(root).not.toHaveAttribute("data-theme", /.*/);
  expect(await bg()).toBe("rgb(247, 248, 250)");

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  expect(await bg()).toBe("rgb(15, 20, 25)");

  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
});

test("a dark system preference is followed when nothing is saved", async ({ browser }) => {
  const page = await (await browser.newContext({ colorScheme: "dark" })).newPage();
  await page.goto("http://localhost:4173/");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
    "rgb(15, 20, 25)",
  );
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
});
