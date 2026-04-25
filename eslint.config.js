import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        Log: "readonly",
        Module: "readonly",
        CanonicalViewAdapter: "readonly",
        CompetitionProvider: "readonly",
        config: "readonly",
        moment: "readonly",
        COMPETITION_KEYS: "readonly",
        COMPETITION_PROVIDER_KEYS: "readonly",
        DEFAULT_COMPETITION_PROVIDER: "readonly",
        getCompetitionProviderKeys: "readonly",
        getCompetitionKey: "readonly",
        getCompetitionValue: "readonly",
        isCompetitionKey: "readonly",
        isProviderCompetitionValue: "readonly"
      }
    },
    rules: {
      "no-redeclare": "off",
      "no-undef": "error"
    }
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.mocha
      }
    }
  }
];
