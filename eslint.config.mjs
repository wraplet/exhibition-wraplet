import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default [
    {files: ["**/*.{js,mjs,cjs,ts}"]},
    {languageOptions: {globals: globals.browser}},
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    eslintPluginPrettierRecommended,
    {
      languageOptions: {
        parserOptions: {
          project: "./tsconfig.json",
        }
      },
      rules: {
          "@typescript-eslint/no-explicit-any": "off",
          "@typescript-eslint/no-empty-object-type": "off",
          "@typescript-eslint/prefer-as-const": "off",
      },
    },
];