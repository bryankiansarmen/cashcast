import { expect, test as base } from "@playwright/test";
import { guardNetwork } from "./network-guard";

/**
 * `test` with automatic guards. A test fails if it causes a console error or an uncaught exception, or if the
 * page tries to reach anything but the local server.
 */
export const test = base.extend<{ guards: void }>({
  guards: [
    async ({ page, context }, use) => {
      const problems: string[] = [];
      page.on(
        "console",
        (m) => m.type() === "error" && problems.push(`console error: ${m.text()}`),
      );
      page.on("pageerror", (e) => problems.push(`uncaught: ${e.message}`));
      const blocked = await guardNetwork(context);
      await use();
      expect(problems).toEqual([]);
      expect(blocked, "the page made non-local requests").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };
