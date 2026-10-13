import { fileURLToPath } from "node:url";
import { expect, test } from "../support/test";

const BASE = "/cashcast/";
const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

/** Records every Content-Security-Policy violation the page reports, across navigations. */
test.beforeEach(async ({ page }) => {
  (page as unknown as { violations: string[] }).violations = [];
  await page.exposeFunction("reportCsp", (m: string) =>
    (page as unknown as { violations: string[] }).violations.push(m),
  );
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      void (window as unknown as { reportCsp: (m: string) => void }).reportCsp(
        `${e.violatedDirective}: ${e.blockedURI}`,
      );
    });
  });
});
const violations = (page: unknown) => (page as { violations: string[] }).violations;

test("the build under the Pages base path serves every asset from that path", async ({ page }) => {
  const responses: { url: string; status: number }[] = [];
  page.on("response", (r) =>
    responses.push({ url: new URL(r.url()).pathname, status: r.status() }),
  );
  await page.goto(BASE);
  await expect(page.locator(".metric-value").first()).toBeVisible();

  expect(responses.length).toBeGreaterThan(2);
  expect(
    responses.filter((r) => r.status >= 400),
    "failed requests",
  ).toEqual([]);
  expect(
    responses.filter((r) => !r.url.startsWith(BASE)),
    "requests outside the base path",
  ).toEqual([]);

  const urls = await page.evaluate(() => ({
    scripts: [...document.scripts].map((s) => new URL(s.src).pathname),
    styles: [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(
      (l) => new URL(l.href).pathname,
    ),
    icon: new URL(document.querySelector<HTMLLinkElement>('link[rel="icon"]')!.href).pathname,
  }));
  expect(urls.scripts.length).toBeGreaterThan(0);
  for (const path of [...urls.scripts, ...urls.styles])
    expect(path).toMatch(/^\/cashcast\/assets\//);
  expect(urls.icon).toBe("/cashcast/favicon.svg");
  // The styles really applied, so the stylesheet loaded under the policy.
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain(
    "system-ui",
  );
});

test("hash routes and reloads work under the base path", async ({ page }) => {
  await page.goto(`${BASE}#/budget`);
  await expect(page.getByRole("heading", { name: "Budget", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Forecast" }).click();
  await expect(page).toHaveURL(`http://localhost:4174${BASE}#/forecast`);
  await expect(page.getByRole("heading", { name: "Forecast", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Forecast", exact: true })).toBeVisible();
});

test("the page carries a strict content security policy and a full journey violates none of it", async ({
  page,
}) => {
  await page.goto(BASE);
  const policy = (await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute("content"))!;
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("script-src 'self'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("base-uri 'self'");
  expect(policy).not.toMatch(/unsafe-eval/);
  expect(policy.match(/script-src[^;]*/)![0]).not.toContain("unsafe-inline");

  // Exercise everything that draws, styles, or opens something: chart, explain panel, imports, edits, both pages.
  await expect(page.locator(".recharts-line-curve")).toHaveCount(3);
  await page.locator('[data-explain-id="forecast.collected13"]').click();
  await page.keyboard.press("Escape");
  await page.getByTestId("file-AR aging CSV").setInputFiles(fixture("ar-quickbooks-style.csv"));
  await expect(page.getByText("Imported 5 invoices")).toBeVisible();
  await page.getByLabel("Current curve, week 1 (%)", { exact: true }).fill("30");
  await page.getByRole("link", { name: "Budget" }).click();
  await page
    .getByTestId("file-Transactions CSV")
    .setInputFiles(fixture("transactions-debit-credit.csv"));
  await expect(page.getByText("Imported 5 transactions")).toBeVisible();
  await page.locator("details summary").first().click();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  expect(violations(page), "content security policy violations").toEqual([]);
});
