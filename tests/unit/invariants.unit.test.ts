import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json")) as Record<string, Record<string, string> | undefined>;
const dependencyNames = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
].flatMap((k) => Object.keys(pkg[k] ?? {}));

const AI_SDK =
  /^(ai|openai|anthropic|langchain|llamaindex|ollama|cohere-ai|replicate|groq-sdk|together-ai)$|^@(ai-sdk|anthropic-ai|langchain|huggingface|mistralai|google\/generative-ai|google-cloud\/vertexai|aws-sdk\/client-bedrock)/;
const TRACKING =
  /analytics|segment|mixpanel|sentry|posthog|amplitude|gtag|hotjar|datadog|logrocket|fullstory/i;

describe("INV-02: no AI SDK is a dependency", () => {
  it("package.json lists none", () => {
    expect(dependencyNames.filter((n) => AI_SDK.test(n))).toEqual([]);
  });

  it("the check recognises the common SDKs, so a pass means something", () => {
    for (const name of [
      "openai",
      "@anthropic-ai/sdk",
      "ai",
      "@ai-sdk/openai",
      "langchain",
      "@langchain/core",
      "@google/generative-ai",
      "ollama",
    ]) {
      expect(AI_SDK.test(name), name).toBe(true);
    }
    for (const name of [
      "react",
      "recharts",
      "papaparse",
      "@types/node",
      "vitest",
      "@playwright/test",
      "tailwindcss",
    ]) {
      expect(AI_SDK.test(name), name).toBe(false);
    }
  });

  it("the package has some dependencies to check", () => {
    expect(dependencyNames).toContain("react");
  });
});

describe("INV-08: no analytics or third-party scripts", () => {
  it("package.json lists no tracking or analytics package", () => {
    expect(dependencyNames.filter((n) => TRACKING.test(n))).toEqual([]);
  });

  it("index.html loads nothing from another origin", () => {
    const html = read("index.html");
    expect(html).toContain('<script type="module" src="/src/main.tsx">');
    expect(html.match(/(?:src|href)=["']https?:\/\//g) ?? []).toEqual([]);
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/); // no inline script
  });
});
