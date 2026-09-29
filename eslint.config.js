/** @type {import('eslint').Linter.Config} */
module.exports = [
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: require("@typescript-eslint/parser"),
    },
    plugins: {
      react: require("eslint-plugin-react"),
      "react-hooks": require("eslint-plugin-react-hooks"),
      import: require("eslint-plugin-import"),
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-console": "warn",
    },
  },
  {
    ignores: ["node_modules/", ".next/", "artifacts/", "*.test.ts", "*.test.tsx"]
  }
];
