import { fileURLToPath } from "node:url";
import { expect, test } from "../support/test";
import { isLocal } from "../support/network-guard";

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const MARKER = "SECRET-MARKER-9f3a";
const upload = (page: import("@playwright/test").Page, id: string, name: string, csv: string) =>
  page.getByTestId(id).setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from(csv) });

/** A journey through every feature that handles user data, using a recognisable marker in the data. */
async function journey(page: import("@playwright/test").Page) {
  await page.goto("/");
  await upload(
    page,
    "file-AR aging CSV",
    "ar.csv",
    `Customer,Num,Due Date,Open Balance\n${MARKER} Ltd,1,2026-10-01,"$5,000.00"\n`,
  );
  await expect(page.getByText("Imported 1 invoices from ar.csv.")).toBeVisible();
  await upload(
    page,
    "file-Payment history CSV (optional)",
    "h.csv",
    `Customer,Due Date,Paid Date\n${MARKER} Ltd,2026-01-01,2026-02-01\n${MARKER} Ltd,2026-02-01,2026-03-01\n${MARKER} Ltd,2026-03-01,2026-04-01\n`,
  );
  await expect(page.getByText("Imported 3 paid invoices")).toBeVisible();
  await page.getByLabel("Current curve, week 1 (%)", { exact: true }).fill("30");
  await page.locator('[data-explain-id="forecast.collected13"]').click();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Budget" }).click();
  await upload(
    page,
    "file-Transactions CSV",
    "t.csv",
    `Date,Description,Amount\n2026-09-02,${MARKER} purchase,-45.00\n`,
  );
  await expect(page.getByText("Imported 1 transactions")).toBeVisible();
  await page.getByLabel("Travel monthly target in dollars").fill("7777");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.reload();
}

test("a full journey makes only same-origin requests and never sends user data anywhere", async ({
  page,
}) => {
  const seen: { url: string; body: string | null }[] = [];
  page.on("request", (r) => seen.push({ url: r.url(), body: r.postData() }));
  await journey(page);

  expect(seen.length).toBeGreaterThan(0);
  for (const { url, body } of seen) {
    expect(isLocal(url), url).toBe(true);
    expect(url).not.toContain(MARKER);
    expect(decodeURIComponent(url)).not.toContain(MARKER);
    expect(body ?? "").not.toContain(MARKER);
  }
  const origins = new Set(
    seen.filter((r) => r.url.startsWith("http")).map((r) => new URL(r.url).origin),
  );
  expect([...origins]).toEqual(["http://localhost:4173"]);
});

test("the browser keeps only assumptions and the theme, and never the data that was imported", async ({
  page,
  context,
}) => {
  await journey(page);
  const stored = await page.evaluate(async () => ({
    local: Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])),
    session: Object.keys(sessionStorage),
    databases: indexedDB.databases ? (await indexedDB.databases()).length : 0,
  }));
  expect(Object.keys(stored.local).sort()).toEqual(["cashcast-theme", "cashcast.assumptions.v1"]);
  expect(JSON.stringify(stored.local)).not.toContain(MARKER);
  expect(JSON.stringify(stored.local)).not.toContain("777700"); // the budget target is not stored either
  expect(stored.session).toEqual([]);
  expect(stored.databases).toBe(0);
  expect(await context.cookies()).toEqual([]);
});

test("the page loads no third-party scripts, styles, frames, or fonts", async ({ page }) => {
  await page.goto("/");
  await page.goto("/#/budget");
  const external = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[src], [href], iframe, object, embed")]
      .map((el) => (el as HTMLAnchorElement).href || (el as HTMLImageElement).src || el.tagName)
      .filter((u) => /^https?:/.test(u) && new URL(u).origin !== location.origin),
  );
  expect(external).toEqual([]);
  expect(await page.locator("iframe, object, embed").count()).toBe(0);
  const sheets = await page.evaluate(
    () =>
      [...document.styleSheets]
        .flatMap((s) => [...s.cssRules])
        .filter((r) => r.cssText.includes("@import") || /url\(\s*['"]?https?:/.test(r.cssText))
        .length,
  );
  expect(sheets).toBe(0);
});

test("an HTML-looking customer name is shown as literal text and runs nothing", async ({
  page,
}) => {
  let dialogs = 0;
  page.on("dialog", (d) => {
    dialogs++;
    void d.dismiss();
  });
  await page.goto("/");
  await page.getByTestId("file-AR aging CSV").setInputFiles(fixture("ar-xss-name.csv"));
  await expect(page.getByText("Imported 2 invoices from ar-xss-name.csv.")).toBeVisible();
  const customers = page.getByRole("region", { name: "Aging by customer" });
  await expect(customers).toContainText("<img src=x onerror=alert(1)>");
  await expect(customers).toContainText("<script>alert('x')</script> Co");
  await expect(page.getByRole("region", { name: "Customer adjustments" })).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  expect(await page.locator("img[src='x']").count()).toBe(0);
  expect(await page.locator("script:not([src])").count()).toBe(0); // no inline script was injected
  expect(dialogs).toBe(0);
});

test("the network guard really fails a test that reaches outside", async ({ page }) => {
  test.fail(); // expected to fail: the page tries a non-local request, which the guard records and blocks
  await page.goto("/");
  await page.evaluate(() => fetch("https://example.com/track").catch(() => undefined));
});
