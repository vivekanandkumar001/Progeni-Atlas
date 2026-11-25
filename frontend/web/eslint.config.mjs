import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // eslint-config-next does not register this plugin under the flat-config
    // key used below in every version; declare it explicitly so the rules
    // resolve and `npm run lint` works without extra CLI flags.
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // Promoted to error: correctness rules with zero current violations, or
      // violations fixed in this pass. CI (`npm run lint`) fails on errors.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/purity": "warn",
      "prefer-const": "error",
      "@typescript-eslint/no-require-imports": "error",
      "@next/next/no-img-element": "error",
      // Debug logging must not ship: only console.warn/console.error survive.
      "no-console": ["error", { allow: ["warn", "error"] }],

      // Remaining known-debt rules (kept at warn deliberately; counts from the
      // 2026-01 baseline lint: any=80, unused-vars=197, set-state-in-effect=40,
      // refs=14, exhaustive-deps=13, this-alias/require-imports=0).
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-this-alias": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  {
    // Standalone Node build/maintenance scripts legitimately use CommonJS
    // requires and console.log; the React rules above target app source only.
    files: ["scripts/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-console": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "public/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;