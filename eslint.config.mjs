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
  // design/ holds generated design-tool exports; the rest is build / test output.
  globalIgnores([
    ".next/**",
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
