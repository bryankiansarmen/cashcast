import { expect, test as base } from "@playwright/test";

/** `test` with an automatic guard: any console error or uncaught exception fails the test that caused it. */
export const test = base.extend<{ consoleGuard: void }>({
  consoleGuard: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on(
        "console",
        (m) => m.type() === "error" && problems.push(`console error: ${m.text()}`),
      );
      page.on("pageerror", (e) => problems.push(`uncaught: ${e.message}`));
      await use();
      expect(problems).toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };
