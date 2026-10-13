import type { BrowserContext } from "@playwright/test";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** True for the app's own server and for in-page schemes; anything else would leave the machine. */
export const isLocal = (url: string): boolean => {
  const u = new URL(url);
  return ["data:", "blob:", "about:"].includes(u.protocol) || LOCAL_HOSTS.has(u.hostname);
};

/**
 * Blocks every non-local request in the context (INV-08) and returns the live list of URLs that tried,
 * so a test can fail when the list is not empty.
 */
export async function guardNetwork(context: BrowserContext): Promise<string[]> {
  const blocked: string[] = [];
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (isLocal(url)) return route.continue();
    blocked.push(url);
    return route.abort();
  });
  return blocked;
}
