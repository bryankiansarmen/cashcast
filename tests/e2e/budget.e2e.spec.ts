import { fileURLToPath } from "node:url";
import { expect, test } from "../support/test";

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const TX = "file-Transactions CSV";

const metric = (page: import("@playwright/test").Page, label: string) =>
  page.locator(".metric", { hasText: label }).locator(".metric-value");
const row = (page: import("@playwright/test").Page, category: string) =>
  page
    .getByRole("region", { name: "Spending against monthly targets" })
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: category, exact: true }) });

test.beforeEach(async ({ page }) => {
  await page.goto("/#/budget");
});

test("the page loads sample transactions on first visit and shows the latest month", async ({
  page,
}) => {
  await expect(page.getByRole("heading", { name: "Budget", exact: true })).toBeVisible();
  await expect(page.getByText("Showing sample transactions")).toBeVisible();
  await expect(page.getByText("61 transactions across 3 months.")).toBeVisible();
  await expect(page.getByLabel("Month", { exact: true })).toHaveValue("2026-09");
  await expect(
    page.getByRole("heading", { name: "Spending against targets, September 2026" }),
  ).toBeVisible();
});

test("summary metrics show the recorded September figures", async ({ page }) => {
  await expect(metric(page, "Total spend")).toHaveText("$4,800");
  await expect(metric(page, "Total budget")).toHaveText("$4,775");
  await expect(metric(page, "Spend versus budget")).toHaveText("$25");
  await expect(metric(page, "Categories over budget")).toHaveText("2");
  await expect(metric(page, "Unbudgeted spend")).toHaveText("$172");
});

test("status badges use text and an icon, not colour alone", async ({ page }) => {
  await expect(row(page, "Travel")).toContainText("▲ Over budget");
  await expect(row(page, "Meals")).toContainText("! Near budget");
  await expect(row(page, "Marketing")).toContainText("✓ On track");
  await expect(row(page, "Staff welfare")).toContainText("? Unbudgeted");
});

test("choosing another month recomputes the table", async ({ page }) => {
  const before = await metric(page, "Total spend").textContent();
  await page.getByLabel("Month", { exact: true }).selectOption("2026-07");
  await expect(
    page.getByRole("heading", { name: "Spending against targets, July 2026" }),
  ).toBeVisible();
  await expect(metric(page, "Total spend")).not.toHaveText(before!);
  await expect(row(page, "Travel")).toContainText("▲ Over budget"); // July travel was also over
});

test("a target typed in dollars changes status and totals, and an invalid one is not applied", async ({
  page,
}) => {
  const travel = page.getByLabel("Travel monthly target in dollars");
  await expect(travel).toHaveValue("600");
  await travel.fill("1000");
  await expect(row(page, "Travel")).toContainText("✓ On track");
  await expect(metric(page, "Categories over budget")).toHaveText("1");
  await expect(metric(page, "Total budget")).toHaveText("$5,175");

  await travel.fill("abc");
  await expect(travel).toHaveAttribute("aria-invalid", "true");
  const describedBy = await travel.getAttribute("aria-describedby");
  await expect(page.locator(`[id="${describedBy}"]`)).toContainText("Enter an amount in dollars");
  await expect(travel).toHaveValue("abc"); // what was typed stays visible
  await expect(metric(page, "Total budget")).toHaveText("$5,175"); // the last valid target still applies

  await travel.fill("-5");
  await expect(page.locator(`[id="${describedBy}"]`)).toContainText("cannot be negative");

  await travel.fill("");
  await expect(row(page, "Travel")).toContainText("? Unbudgeted");
  await expect(travel).not.toHaveAttribute("aria-invalid", "true");
});

test("a target on a category with a space in its name ties its message to the field", async ({
  page,
}) => {
  const office = page.getByLabel("Office supplies monthly target in dollars");
  await office.fill("x");
  const describedBy = await office.getAttribute("aria-describedby");
  expect(describedBy).toMatch(/^err-[A-Za-z0-9-]+$/);
  await expect(page.locator(`[id="${describedBy}"]`)).toBeVisible();
});

test("reset restores the sample targets", async ({ page }) => {
  await page.getByLabel("Travel monthly target in dollars").fill("1000");
  await page.getByRole("button", { name: "Reset targets to the sample" }).click();
  await expect(page.getByLabel("Travel monthly target in dollars")).toHaveValue("600");
  await expect(metric(page, "Categories over budget")).toHaveText("2");
});

test("top contributors expand per category and list the three largest outflows", async ({
  page,
}) => {
  const travel = row(page, "Travel");
  const details = travel.locator("details");
  await expect(details).not.toHaveAttribute("open", "");
  await details.locator("summary").click();
  await expect(details).toHaveAttribute("open", "");
  await expect(details.getByRole("listitem")).toHaveCount(3);
  await expect(details.getByRole("listitem").first()).toContainText("2026-09-");
  await expect(details.getByRole("listitem").first()).toContainText("$");
});

test("sorting the table by spend works from the keyboard", async ({ page }) => {
  const table = page.getByRole("region", { name: "Spending against monthly targets" });
  await expect(table.getByRole("columnheader", { name: /^Spend/ })).toHaveAttribute(
    "aria-sort",
    "descending",
  );
  await table.getByRole("button", { name: /^Category/ }).focus();
  await page.keyboard.press("Enter");
  await expect(table.getByRole("columnheader", { name: /^Category/ })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  await expect(table.getByRole("row").nth(1)).toContainText("Insurance");
});

test("importing a bank-style debit and credit file replaces the transactions", async ({ page }) => {
  await page.getByTestId(TX).setInputFiles(fixture("transactions-debit-credit.csv"));
  await expect(
    page.getByText("Imported 5 transactions from transactions-debit-credit.csv."),
  ).toBeVisible();
  await expect(page.getByText("5 transactions across 1 month.")).toBeVisible();
  await expect(page.getByText("Showing sample transactions")).toHaveCount(0);
  await expect(page.getByLabel("Month", { exact: true })).toHaveValue("2026-07");
  await expect(row(page, "Office supplies")).toContainText("-$34"); // the refund reduces spend
});

test("a failed import lists line, column, and message and keeps the previous transactions", async ({
  page,
}) => {
  await page.getByTestId(TX).setInputFiles(fixture("transactions-malformed.csv"));
  await expect(page.getByRole("alert").first()).toContainText(
    "Could not import transactions-malformed.csv. Your previous data is unchanged.",
  );
  const errors = page.getByRole("region", { name: "Import errors" });
  await expect(errors.getByRole("row")).toHaveCount(6); // header plus five bad rows
  await expect(errors.getByRole("row").nth(1)).toContainText("date");
  await expect(page.getByText("61 transactions across 3 months.")).toBeVisible();
});

test("a file over 5 MB is rejected with the size message", async ({ page }) => {
  await page.getByTestId(TX).setInputFiles({
    name: "huge.csv",
    mimeType: "text/csv",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1, "a"),
  });
  await expect(page.getByRole("region", { name: "Import errors" })).toContainText(
    "File is larger than 5 MB.",
  );
  await expect(page.getByText("61 transactions across 3 months.")).toBeVisible();
});

test("imported descriptions are shown as text, never as HTML", async ({ page }) => {
  const csv = "Date,Description,Amount\n2026-09-02,<img src=x onerror=alert(1)>,-45.00\n";
  await page
    .getByTestId(TX)
    .setInputFiles({ name: "xss.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByText("Imported 1 transactions")).toBeVisible();
  const uncategorized = row(page, "Uncategorized");
  await uncategorized.locator("summary").click();
  await expect(uncategorized.getByRole("listitem")).toContainText("<img src=x onerror=alert(1)>");
  expect(await page.locator("img[src='x']").count()).toBe(0);
});

test("the sample can be reloaded after an import, and the forecast page is unaffected", async ({
  page,
}) => {
  await page.getByTestId(TX).setInputFiles(fixture("transactions-debit-credit.csv"));
  await expect(page.getByText("5 transactions across 1 month.")).toBeVisible();
  await page.getByRole("link", { name: "Forecast" }).click();
  await expect(page.getByText("60 invoices as of 2026-09-30")).toBeVisible();
  await expect(page.getByText("Imported 5 transactions")).toHaveCount(0); // that report belongs to the Budget page
});

test("every figure on the page has an explain button that opens a complete panel", async ({
  page,
}) => {
  const expected = [
    "budget.categoriesOver",
    "budget.categorySpend",
    "budget.categoryStatus",
    "budget.categoryVariance",
    "budget.contributors",
    "budget.target",
    "budget.totalBudget",
    "budget.totalSpend",
    "budget.unbudgetedSpend",
    "budget.variance",
  ];
  const triggers = page.locator("[data-explain-id]");
  expect(
    await triggers.evaluateAll((els) =>
      [...new Set(els.map((e) => e.getAttribute("data-explain-id")))].sort(),
    ),
  ).toEqual(expected);
  const dialog = page.getByRole("dialog");
  for (let i = 0; i < (await triggers.count()); i++) {
    const trigger = triggers.nth(i);
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await expect(dialog).toBeVisible();
    for (const heading of ["How this is calculated", "Inputs", "Assumptions used"]) {
      await expect(dialog.getByRole("heading", { name: heading })).toBeVisible();
    }
    await expect(dialog).toContainText("September 2026");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
});
