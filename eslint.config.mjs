// ESLint Flat Config für NIMM! – Vanilla-JS ohne Build-Schritt.
//
// Die Browser-App läuft dependency-frei per `file://` (klassische Skripte,
// kein `type="module"`); deshalb nutzt hier auch die ESLint-Konfiguration
// `sourceType: "script"`. Die Dev-Toolchain berührt die ausgelieferten
// Dateien nicht: ESLint und Prettier sind ausschließlich devDependencies.
//
// Zwei Bereiche:
//  1. Produktion (`nim.js`, `ai.js`, `game.js`): Browser-Globals, ES2022.
//  2. Tests (`tests/*.js`): Node-Globals (CommonJS-Tests). Der E2E-Runner
//     `tests/e2e-browser.js` läuft zwar im Browser, wird aber über Node
//     gestartet und ist Teil der Testlaufzeit.

import globals from "globals";

// Browser-Globals, die die App und der E2E-Runner verwenden.
const browserGlobals = {
  ...globals.browser,
  window: "readonly",
  document: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  requestAnimationFrame: "readonly",
  cancelAnimationFrame: "readonly",
  fetch: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  MutationObserver: "readonly",
  ResizeObserver: "readonly",
  IntersectionObserver: "readonly",
  PointerEvent: "readonly",
  CustomEvent: "readonly",
  AbortController: "readonly",
};

const productionRules = {
  // Korrektheit
  eqeqeq: ["error", "always", { null: "ignore" }],
  "no-undef": "error",
  "no-unused-vars": [
    "warn",
    { vars: "all", args: "after-used", caughtErrors: "none" },
  ],
  "no-redeclare": "error",
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-with": "error",
  "no-async-promise-executor": "error",
  "no-constant-condition": ["error", { checkLoops: false }],
  "no-dupe-keys": "error",
  "no-fallthrough": "error",
  "no-unreachable": "error",
  "no-sparse-arrays": "error",
  "use-isnan": "error",
  "valid-typeof": "error",
  "no-else-return": ["error", { allowElseIf: true }],

  // Stil – konservativ, ohne Refactoring-Zwang
  semi: ["error", "always"],
  quotes: ["error", "double", { avoidEscape: true }],
  "no-var": "off",
  "prefer-const": ["error", { destructuring: "all" }],
};

export default [
  {
    // Globale Ausnahmen für die Dev-Toolchain selbst + generierte Artefakte.
    ignores: [
      "node_modules/**",
      "package-lock.json",
      "eslint.config.mjs",
      // c8-Coverage-HTML-Bericht (lokal erzeugt, git-ignoriert)
      "coverage/**",
      // Playwright-Artefakte (lokal bei Bedarf erzeugt, git-ignoriert)
      "test-results/**",
      "playwright-report/**",
    ],
  },

  {
    // Produktions-Code: Browser + ES2022.
    files: ["nim.js", "ai.js", "game.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: browserGlobals,
    },
    rules: productionRules,
  },

  {
    // Tests: Node/ES2022 + ein paar Browser-Globals, die der E2E-Runner
    // und die VM-Mocks tatsächlich verwenden.
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.node,
        ...browserGlobals,
      },
    },
    rules: {
      ...productionRules,
      // Test-Doubles deklarieren absichtlich globale Browsernamen mehrfach.
      "no-else-return": "off",
      "no-redeclare": "off",
      "no-unused-vars": "off",
    },
  },
];
