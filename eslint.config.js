import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    // Configuración para ESLint (archivos .js, .mjs, .cjs)
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest
      },
    },
  },
  {
    // Ignorar coverage/, logs/ y node_modules/
    ignores: [
      "coverage/**",
      "logs/**",
      "node_modules/**"
    ],
  }
]);
