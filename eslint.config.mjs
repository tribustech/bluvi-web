import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // core/ must run anywhere (Next server, browser, later the Expo app): no framework or DOM at runtime.
    files: ["core/**/*.ts"],
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
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
