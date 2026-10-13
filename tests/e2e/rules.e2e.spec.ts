import type { Page } from "@playwright/test";
import { expect, test } from "../support/test";

const TX = "file-Transactions CSV";
const variance = (page: Page) =>
  page.getByRole("region", { name: "Spending against monthly targets" });
const varianceRow = (page: Page, category: string) =>
  variance(page)
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: category, exact: true }) });
const rulesTable = (page: Page) => page.getByRole("region", { name: "Categorization rules" });
const queue = (page: Page) => page.getByRole("region", { name: "Uncategorized transactions" });
const importCsv = (page: Page, csv: string) =>
  page
    .getByTestId(TX)
    .setInputFiles({ name: "t.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

test.beforeEach(async ({ page }) => {
  await page.goto("/#/budget");
});

test("the sample rules are listed in order, and the ends cannot move past the list", async ({
  page,
}) => {
  await expect(rulesTable(page).getByRole("row")).toHaveCount(15); // header plus 14 rules
  await expect(page.getByLabel("Rule 1: description contains")).toHaveValue("cloudbench");
  await expect(page.getByLabel("Rule 1: category")).toHaveValue("Software");
  await expect(page.getByLabel("Rule 14: description contains")).toHaveValue("maple court");
  await expect(page.getByRole("button", { name: "Move rule 1 up" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Move rule 14 down" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Move rule 2 up" })).toBeEnabled();
});

test("reordering rules changes which rule wins", async ({ page }) => {
  // "Cafe catering" matches rule 6 (cafe, Meals) and rule 8 (catering, which we point at Events).
  await importCsv(page, "Date,Description,Amount\n2026-09-01,Cafe catering,-10.00\n");
  await expect(page.getByText("Imported 1 transactions")).toBeVisible();
  await page.getByLabel("Rule 8: category").fill("Events");
  await expect(varianceRow(page, "Meals")).toContainText("$10");
  await expect(varianceRow(page, "Events")).toHaveCount(0);

  await page.getByRole("button", { name: "Move rule 8 up" }).click();
  await page.getByRole("button", { name: "Move rule 7 up" }).click(); // the catering rule is now rule 7, then 6
  await expect(page.getByLabel("Rule 6: description contains")).toHaveValue("catering");
  await expect(varianceRow(page, "Events")).toContainText("$10");
  await expect(varianceRow(page, "Meals")).toContainText("$0");
});

test("an invalid edit is blocked with a message tied to its field and the rule is unchanged", async ({
  page,
}) => {
  const contains = page.getByLabel("Rule 1: description contains");
  await contains.fill("");
  await expect(contains).toHaveAttribute("aria-invalid", "true");
  const describedBy = await contains
    .getByText("")
    .count()
    .then(() => contains.getAttribute("aria-describedby"));
  await expect(page.locator(`[id="${describedBy}"]`)).toContainText(
    "Enter the text to look for in the description.",
  );
  await expect(contains).toHaveValue(""); // what was typed stays visible
  await expect(varianceRow(page, "Software")).toContainText("$191"); // still categorized by the old rule

  await contains.fill("cloudbench");
  await expect(contains).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(`[id="${describedBy}"]`)).toHaveCount(0);

  const category = page.getByLabel("Rule 1: category");
  await category.fill("x".repeat(41));
  await expect(page.getByRole("alert").filter({ hasText: "at most 40 characters" })).toBeVisible();
  await category.fill("");
  await expect(page.getByRole("alert").filter({ hasText: "Enter a category." })).toBeVisible();
});

test("adding a rule: invalid input is blocked inline, valid input appears at the end", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add rule" }).click();
  const error = page.locator("#err-new-rule");
  await expect(error).toContainText("Enter the text to look for");
  await expect(error).toContainText("Enter a category.");
  await expect(rulesTable(page).getByRole("row")).toHaveCount(15);

  await page.getByRole("textbox", { name: "Description contains", exact: true }).fill("  hollow  ");
  await page.getByRole("combobox", { name: "Category", exact: true }).fill("Power");
  await page.getByRole("button", { name: "Add rule" }).click();
  await expect(error).toHaveCount(0);
  await expect(rulesTable(page).getByRole("row")).toHaveCount(16);
  await expect(page.getByLabel("Rule 15: description contains")).toHaveValue("hollow"); // trimmed
  await expect(page.getByLabel("Rule 15: category")).toHaveValue("Power");
});

test("deleting a rule sends its transactions to the uncategorized queue", async ({ page }) => {
  await expect(queue(page).getByRole("row")).toHaveCount(2); // header plus the one September transaction
  await page.getByRole("button", { name: "Delete rule 14" }).click(); // maple court: Rent
  await expect(page.getByLabel("Rule 14: description contains")).toHaveCount(0);
  await expect(varianceRow(page, "Rent")).toContainText("$0");
  await expect(queue(page)).toContainText("Maple Court Properties rent");
  await expect(
    page.getByText("2 transactions have no category and no matching rule."),
  ).toBeVisible();
});

test("the queue lists September's uncategorized transaction with a suggested match text", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "Uncategorized transactions, September 2026" }),
  ).toBeVisible();
  await expect(page.getByText("1 transaction has no category and no matching rule.")).toBeVisible();
  await page.getByRole("button", { name: /^Create a rule from/ }).click();
  const form = page.getByRole("group", { name: /^Create a rule from/ });
  await expect(
    form.getByRole("textbox", { name: "Description contains", exact: true }),
  ).not.toHaveValue("");
});

test("creating a rule from a transaction moves it out of the queue at once", async ({ page }) => {
  await page.getByRole("button", { name: /^Create a rule from/ }).click();
  const form = page.getByRole("group", { name: /^Create a rule from/ });
  await expect(form).toBeVisible();

  await form.getByRole("button", { name: "Create rule" }).click(); // no category yet
  await expect(page.locator("#err-queue-rule")).toContainText("Enter a category.");
  await expect(form).toBeVisible();

  await form.getByRole("combobox", { name: "Category", exact: true }).fill("Supplies");
  await form.getByRole("button", { name: "Create rule" }).click();
  await expect(page.getByText("Nothing is uncategorized in September 2026.")).toBeVisible();
  await expect(form).toHaveCount(0);
  await expect(varianceRow(page, "Supplies")).toContainText("Unbudgeted"); // a new category, no target yet
  await expect(page.getByLabel("Rule 15: category")).toHaveValue("Supplies");
});

test("cancelling the queue form creates nothing", async ({ page }) => {
  await page.getByRole("button", { name: /^Create a rule from/ }).click();
  await page
    .getByRole("group", { name: /^Create a rule from/ })
    .getByRole("button", { name: "Cancel" })
    .click();
  await expect(page.getByRole("group", { name: /^Create a rule from/ })).toHaveCount(0);
  await expect(rulesTable(page).getByRole("row")).toHaveCount(15);
});

test("a rule made in July also fixes the same merchant in other months", async ({ page }) => {
  await page.getByLabel("Month", { exact: true }).selectOption("2026-07");
  const before = await queue(page).getByRole("row").count();
  await page
    .getByRole("button", { name: /^Create a rule from/ })
    .first()
    .click();
  const form = page.getByRole("group", { name: /^Create a rule from/ });
  await form.getByRole("combobox", { name: "Category", exact: true }).fill("Supplies");
  await form.getByRole("button", { name: "Create rule" }).click();
  await expect(varianceRow(page, "Supplies")).toBeVisible();
  const after = await queue(page)
    .getByRole("row")
    .count()
    .catch(() => 0);
  expect(after).toBeLessThan(before);
});

test("category suggestions come from the categories already in use", async ({ page }) => {
  const options = await page
    .locator("#category-options option")
    .evaluateAll((els) => els.map((e) => e.getAttribute("value")));
  expect(options).toEqual([
    "Insurance",
    "Marketing",
    "Meals",
    "Office supplies",
    "Rent",
    "Software",
    "Staff welfare",
    "Travel",
    "Utilities",
  ]);
});

test("queue descriptions are shown as text, never as HTML", async ({ page }) => {
  await importCsv(
    page,
    "Date,Description,Amount\n2026-09-02,<img src=x onerror=alert(1)>,-45.00\n",
  );
  await expect(queue(page)).toContainText("<img src=x onerror=alert(1)>");
  expect(await page.locator("img[src='x']").count()).toBe(0);
});
