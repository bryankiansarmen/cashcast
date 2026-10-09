import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

const ban = (names, message) => ({
  "no-restricted-imports": ["error", { patterns: [{ group: names, message }] }],
});
const rel = (...dirs) => dirs.flatMap((d) => [`**/${d}`, `**/${d}/**`]);

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules", "playwright-report", "test-results"] },
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "no raw HTML.",
        },
      ],
    },
  },
  // engine imports nothing outside itself (relative imports must stay in-folder).
  {
    files: ["src/engine/**"],
    rules: ban(
      [
        "react",
        "react-dom",
        "react/*",
        "react-dom/*",
        "papaparse",
        "recharts",
        "../*",
        "**/budget/**",
        ...rel("importers", "sample", "viewmodels", "state", "ui"),
      ],
      "engine imports nothing outside itself.",
    ),
  },
  // Budget may import only engine/money and engine/dates.
  {
    files: ["src/budget/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "react/*", "react-dom/*", "papaparse", "recharts"],
              message: "Budget is pure.",
            },
            {
              group: [...rel("importers", "sample", "viewmodels", "state", "ui")],
              message: "No upward imports.",
            },
            {
              regex: "(^|/)engine/(?!(money|dates)(\\.|$)).+|(^|/)engine$",
              message: "Budget may import only engine/money and engine/dates.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/importers/**"],
    rules: ban(
      [
        "react",
        "react-dom",
        "react/*",
        "react-dom/*",
        "recharts",
        ...rel("sample", "viewmodels", "state", "ui"),
      ],
      "Importers: engine/budget + Papa Parse only; no React.",
    ),
  },
  {
    files: ["src/sample/**"],
    rules: ban(
      [
        "react",
        "react-dom",
        "react/*",
        "react-dom/*",
        "papaparse",
        "recharts",
        ...rel("importers", "viewmodels", "state", "ui"),
      ],
      "Sample: types and primitives only.",
    ),
  },
  {
    files: ["src/viewmodels/**"],
    rules: ban(
      [
        "react",
        "react-dom",
        "react/*",
        "react-dom/*",
        "papaparse",
        "recharts",
        ...rel("importers", "sample", "state", "ui"),
      ],
      "Viewmodels are pure.",
    ),
  },
  {
    files: ["src/state/**"],
    rules: ban([...rel("ui"), "recharts"], "state never imports ui."),
  },
  // UI never calls engine/budget math; it renders viewmodels and dispatches actions.
  {
    files: ["src/ui/**"],
    rules: ban(
      [...rel("engine", "budget", "importers", "sample")],
      "ui goes through state/viewmodels.",
    ),
  },
);
