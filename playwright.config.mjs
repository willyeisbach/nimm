// Playwright-Config — NIMM! E2E (Issue #15)
//
// WICHTIG: lokal nur bei Bedarf (npm run test:e2e). Playwright ist KEIN Teil
// der CI (siehe .github/workflows/ci-pages.yml: kein Playwright-Schritt).
//
// Die App läuft dependency-frei per file:// — es gibt keinen Webserver und
// keinen Build-Schritt. Der Test lädt die echte ../index.html über eine
// file://-URL (baseURL wird zur Laufzeit aus dem Repo-Pfad erzeugt).
import { defineConfig } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const appUrl = pathToFileURL(path.join(repoRoot, "index.html")).href;

export default defineConfig({
  testDir: path.join(repoRoot, "tests", "e2e"),
  // Deterministisch: keine Parallelität nötig (einfache App, wenige Szenarien).
  fullyParallel: false,
  workers: 1,
  // Zustände werden per expect.poll/toHave-* aufgerufen — keine blinden
  // Wartezeiten; diese Grenzen greifen nur bei echten Hängen.
  timeout: 20000,
  expect: { timeout: 5000 },
  retry: 0,
  // Fehler erzeugen verwertbare lokale Artefakte: Trace, Screenshot, Video in
  // test-results/ + HTML-Bericht in playwright-report/ (beide in .gitignore).
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    browserName: "chromium",
    // Trace/Screenshot/Video bei Fehlschlag → Debug-Artefakte in test-results/.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1024, height: 768 },
    actionTimeout: 5000,
    // file://-App: kein Webserver, deterministischer Ausgang.
    // (baseURL wird nicht gesetzt — die Spec lädt die file://-URL explizit.)
  },
});
