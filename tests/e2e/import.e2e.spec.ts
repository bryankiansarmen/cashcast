import { fileURLToPath } from "node:url";
import { expect, test } from "../support/test";

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const AR = "file-AR aging CSV";
const HISTORY = "file-Payment history CSV (optional)";

test("first visit shows the sample dataset", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Showing sample data")).toBeVisible();
  await expect(page.getByText("60 invoices as of 2026-09-30")).toBeVisible();
});

test("a valid import replaces the dataset and reports the count", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId(AR).setInputFiles(fixture("ar-quickbooks-style.csv"));
  await expect(page.getByText("Imported 5 invoices from ar-quickbooks-style.csv.")).toBeVisible();
  await expect(page.getByText(/^5 invoices as of \d{4}-\d{2}-\d{2}/)).toBeVisible();
  await expect(page.getByText("Showing sample data")).toHaveCount(0);
  await expect(page.getByText(/ar-quickbooks-style\.csv \(\d+ B\) — imported/)).toBeVisible();
});

test("a failed import shows line, column, and message and keeps the previous data", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId(AR).setInputFiles(fixture("ar-malformed.csv"));
  await expect(page.getByRole("alert")).toContainText(
    "Could not import ar-malformed.csv. Your previous data is unchanged.",
  );
  const errors = page.getByRole("region", { name: "Import errors" });
  await expect(errors.getByRole("columnheader")).toHaveText(["Line", "Column", "Message"]);
  await expect(errors.getByRole("row").nth(1)).toContainText("3");
  await expect(errors.getByRole("row").nth(1)).toContainText("customer");
  await expect(errors.getByRole("row")).toHaveCount(8); // header plus seven bad rows
  await expect(page.getByText("60 invoices as of 2026-09-30")).toBeVisible();
  await expect(page.getByText(/ar-malformed\.csv \(\d+ B\) — not imported/)).toBeVisible();
});

test("warnings from a successful import are listed", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId(AR).setInputFiles(fixture("ar-with-credits.csv"));
  await expect(page.getByText("Imported 2 invoices from ar-with-credits.csv.")).toBeVisible();
  await expect(page.getByText("1 warning; the data was imported.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Import warnings" })).toContainText(
    "Excluded 2 credit lines totalling $1,550.50",
  );
});

test("a file over 5 MB is rejected with the size message and the data stays", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId(AR).setInputFiles({
    name: "huge.csv",
    mimeType: "text/csv",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1, "a"),
  });
  await expect(page.getByRole("region", { name: "Import errors" })).toContainText(
    "File is larger than 5 MB.",
  );
  await expect(page.getByText("60 invoices as of 2026-09-30")).toBeVisible();
});

test("payment history imports separately and is counted", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId(HISTORY).setInputFiles(fixture("history-sample.csv"));
  await expect(page.getByText("Imported 59 paid invoices from history-sample.csv.")).toBeVisible();
  await expect(page.getByText(/with 59 paid invoices of history/)).toBeVisible();
});

test("sorting an error table from the keyboard", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId(AR).setInputFiles(fixture("ar-malformed.csv"));
  const errors = page.getByRole("region", { name: "Import errors" });
  const header = errors.getByRole("button", { name: /^Line/ });
  await header.focus();
  await page.keyboard.press("Enter");
  await expect(errors.getByRole("columnheader", { name: /Line/ })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  await page.keyboard.press("Enter");
  await expect(errors.getByRole("columnheader", { name: /Line/ })).toHaveAttribute(
    "aria-sort",
    "descending",
  );
  await expect(errors.getByRole("row").nth(1)).toContainText("9");
});

test("the as-of date is locked for sample data, then editable after an import", async ({
  page,
}) => {
  await page.goto("/");
  const asOf = page.getByLabel("As-of date");
  await expect(asOf).toHaveValue("2026-09-30");
  await expect(asOf).toBeDisabled();

  await page.getByTestId(AR).setInputFiles(fixture("ar-quickbooks-style.csv"));
  await expect(asOf).toBeEnabled();
  await expect(asOf).toHaveValue(/^\d{4}-\d{2}-\d{2}$/); // today's local date by default

  await asOf.fill("2026-11-01");
  await expect(page.getByText("5 invoices as of 2026-11-01")).toBeVisible();
});

test("the aging summary shows the sample totals and re-sorts the customer table", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("$1,534,534", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("60 invoices across 12 customers")).toBeVisible();
  await expect(page.getByRole("region", { name: "Aging by bucket" }).getByRole("row")).toHaveCount(
    6,
  );
  await expect(page.getByRole("region", { name: "Aging by bucket" })).toContainText(/\d+\.\d%/);

  const customers = page.getByRole("region", { name: "Aging by customer" });
  await expect(customers.getByRole("row")).toHaveCount(13);
  await expect(customers.getByRole("columnheader", { name: /Total/ })).toHaveAttribute(
    "aria-sort",
    "descending",
  );
  await customers.getByRole("button", { name: /^91\+/ }).click();
  await expect(customers.getByRole("columnheader", { name: /91\+/ })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
});

test("importing replaces the aging summary", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId(AR).setInputFiles(fixture("ar-quickbooks-style.csv"));
  await expect(page.getByText("5 invoices across 4 customers")).toBeVisible();
  await expect(page.getByText("$46,526", { exact: true }).first()).toBeVisible();
});
