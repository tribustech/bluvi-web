import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import bluvi from "./eslint-rules/no-raw-visual-values.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // core/ must run anywhere (Next server, browser, later the Expo app): no framework or DOM at runtime.
    files: ["core/**/*.ts"],
    // Tests may use react-query (a real QueryClient) and DOM-ish globals.
    ignores: ["core/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "core/ is framework-free." },
            { name: "react-dom", message: "core/ is framework-free." },
            { name: "react-native", message: "core/ is platform-free." },
            {
              name: "@tanstack/react-query",
              message: "Use the helpers in core/shared/query.ts (type-only imports are fine).",
              allowTypeImports: true,
            },
          ],
          patterns: [
            { group: ["next", "next/*"], message: "core/ is framework-free." },
            { group: ["expo-*", "@react-native-*/*", "@react-native-firebase/*"], message: "core/ is platform-free." },
            { group: ["@/lib/*", "@/app/*", "../lib/*", "../../lib/*"], message: "core/ must not depend on the app." },
          ],
        },
      ],
      "no-restricted-globals": ["error", "window", "document", "localStorage", "sessionStorage", "navigator"],
    },
  },
  {
    // ROADMAP §5 «Lint»: no raw colours, font sizes, line heights or z-index outside the tokens
    // in app/globals.css. See eslint-rules/no-raw-visual-values.mjs.
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    plugins: { bluvi },
    rules: { "bluvi/no-raw-visual-values": "error" },
  },
  {
    // Turbopack cannot tree-shake zod's `z` re-export (it keeps every member of the namespace, every
    // locale and the JSON-schema code included): `import { z }` put ~100 KB of compressed, unused
    // zod in the first-load JS of every page. The namespace import shakes to what is used.
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value='zod'][importKind!='type'] > ImportSpecifier[imported.name='z'][importKind!='type']",
          message: "Use `import * as z from 'zod'`: Turbopack bundles all of zod (every locale) for `import { z }`.",
        },
        // The sticky header stack follows one state on <html> (components/nav/stickyStack.ts): a
        // hand-written `header[data-concealed]` selector drifts from the bar's timing (and :has() is
        // WebKit-sensitive). Use UNDER_BAR_TOP / UNDER_BAR_TOP_PHONE / BAR_EDGE_TOP from shell.tsx.
        {
          selector: "Literal[value=/header\\[data-concealed\\]/], TemplateElement[value.raw=/header\\[data-concealed\\]/]",
          message: "Pinned rows use UNDER_BAR_TOP (components/nav/shell.tsx), never a `header[data-concealed]` selector.",
        },
      ],
    },
  },
  // design/ holds generated design-tool exports; the rest is build / test output.
  globalIgnores([
    ".next/**",
    ".next-*/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "design/**",
    ".lighthouseci/**",
    "test-results/**",
    "playwright-report/**",
    ".shots/**",
  ]),
]);

export default eslintConfig;
