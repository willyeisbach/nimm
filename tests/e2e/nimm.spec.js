// NIMM! — Playwright E2E-Suite (Issue #15)
//
// WICHTIG: diese Suite ist LOKAL NUR BEI BEDARF (npm run test:e2e) —
// Playwright ist bewusst KEIN Teil der CI (Quality-Job = format/lint/unit/
// coverage/Regression, s. .github/workflows/ci-pages.yml).
//
// Sie lädt die ECHTE ../index.html per file:// (kein Webserver, kein Build)
// und prüft dieselben Szenarien wie die dependency-freie Fallback-Suite in
// tests/e2e-browser.html — hier nur mit Playwright-Artefakten (Trace,
// Screenshot, HTML-Bericht) bei Fehlern.

"use strict";

const { test, expect } = require("@playwright/test");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

// Echte App unter file:// (Repo-Root relativ zur Spec).
const APP_URL = pathToFileURL(
  path.resolve(__dirname, "..", "..", "index.html"),
).href;

// --- Deterministische Helfer -------------------------------------------------

// Optionen über die echte Options-UI setzen (min = max ⇒ reproduzierbare Haufen).
// Der Optionsdialog wird über den Zahnrad-Button geöffnet (wie ein Mensch).
async function configureApp(page, opts) {
  await page.locator("#options-btn").click();
  await expect(page.locator("#options-dialog")).toBeVisible();

  await page.locator("#opt-max-heaps").fill("1");
  if (opts.rule) {
    await page.locator(`input[name="opt-rule"][value="${opts.rule}"]`).check();
  }
  if (opts.ownList !== undefined) {
    await page.locator("#opt-own-list").fill(opts.ownList);
  }
  await page.locator("#opt-min-stones").fill(String(opts.minStones));
  await page.locator("#opt-max-stones").fill(String(opts.maxStones));
  if (opts.opponent) {
    await page
      .locator(`input[name="opt-opponent"][value="${opts.opponent}"]`)
      .check();
  }
  if (opts.start) {
    await page
      .locator(`input[name="opt-start"][value="${opts.start}"]`)
      .check();
  }
  await page.locator("#opt-apply").click();
  await expect(page.locator("#options-dialog")).toBeHidden();
}

// Pointer-Tapp auf der n-ten Rosine (0-basiert) — wie im echten Spiel.
async function pointerTap(page, stoneIndex, heapIndex) {
  const stone = page
    .locator(`.heap[data-heap-index="${heapIndex || 0}"] .stone`)
    .nth(stoneIndex);
  const init = { bubbles: true, cancelable: true, button: 0 };
  await stone.dispatchEvent("pointerdown", init);
  await stone.dispatchEvent("pointerup", init);
}

test.beforeEach(async ({ page }) => {
  // Browser- und Konsolenfehler werden hart gefasst (Issue #15, AK).
  page.on("pageerror", (err) => {
    throw new Error("pageerror in App: " + (err && err.message));
  });
  await page.goto(APP_URL, { waitUntil: "load" });
});

// --- Szenarien ---------------------------------------------------------------

test("Initiale Wartephase vor Los!", async ({ page }) => {
  await configureApp(page, {
    minStones: 4,
    maxStones: 4,
    rule: "4er",
    opponent: "Mensch",
    start: "1",
  });
  // „Los!“ ist noch da; die Runde wartet.
  await expect(page.locator("#start-overlay")).toBeVisible();
  await expect(page.locator("#take-btn")).toBeDisabled();
  // Los! gibt die Runde frei.
  await page.locator("#start-go-btn").click();
  await expect(page.locator("#start-overlay")).toBeHidden();
  // Ohne laufende Markierung bleibt „Nimm!“ gesperrt.
  await expect(page.locator("#take-btn")).toBeDisabled();
});

test("Optionen und Regelhinweis", async ({ page }) => {
  await configureApp(page, {
    minStones: 3,
    maxStones: 3,
    rule: "own",
    ownList: "1,3",
    opponent: "Mensch",
    start: "1",
  });
  const s = await page.evaluate(() => window.Game.state);
  expect(s.rule).toBe("own");
  expect(s.allowed).toEqual([1, 3]);
  await expect(page.locator("#rule-hint")).toContainText("1 oder 3");
  await expect(page.locator("#rule-hint")).toContainText(
    "Wer die letzte nimmt, gewinnt!",
  );
  // Optionsdialog ist geschlossen; die Runde wartet auf Los!.
  await expect(page.locator("#options-dialog")).toBeHidden();
  await expect(page.locator("#start-overlay")).toBeVisible();
});

test("Mensch-Start: Markieren und „Nimm!“-Bestätigung", async ({ page }) => {
  await configureApp(page, {
    minStones: 4,
    maxStones: 4,
    rule: "4er",
    opponent: "Mensch",
    start: "1",
  });
  await page.locator("#start-go-btn").click();
  await expect(page.locator("#take-btn")).toBeDisabled();

  // Schritt 1: dritte Rosine tippen = MARKIEREN (entfernt noch nichts).
  await pointerTap(page, 2, 0);
  await expect(
    page.locator('.heap[data-heap-index="0"] .stone.selected'),
  ).toHaveCount(3);
  let s = await page.evaluate(() => window.Game.state);
  expect(s.heaps).toEqual([4]);
  expect(s.selectedAmount).toBe(3);
  expect(s.lastMove).toBeNull();
  await expect(page.locator("#take-btn")).toBeEnabled();
  await expect(page.locator("#take-btn")).toContainText("Nimm 3 Rosinen");

  // Schritt 2: „Nimm!“ = ZUG — genau 3 werden entfernt.
  await page.locator("#take-btn").click();
  await page.waitForFunction(() => window.Game.state.lock === false, null, {
    timeout: 5000,
  });
  s = await page.evaluate(() => window.Game.state);
  expect(s.heaps).toEqual([1]);
  expect(s.lastMove.player).toBe(1);
  expect(s.lastMove.amount).toBe(3);
  expect(s.selectedAmount).toBeNull();
  await expect(page.locator("#take-btn")).toBeDisabled();
});

test("KI-Start: Denkblase, Lock und KI-Zug", async ({ page }) => {
  await configureApp(page, {
    minStones: 4,
    maxStones: 4,
    rule: "4er",
    opponent: "Baxi",
    start: "2",
  });
  await page.locator("#start-go-btn").click();

  // Warte auf die KI-Denkphase: Lock gesetzt, Sprechblase „…denkt…“.
  const thinking = () =>
    page.evaluate(() => {
      const s = window.Game.state;
      return s.lock === true && /denkt/.test((s.bubble || {})[2] || "");
    });
  await expect.poll(thinking, { timeout: 5000 }).toBe(true);

  // Nach dem KI-Zug: Lock frei, Mensch dran, letzter Zug der KI.
  await page.waitForFunction(
    () => {
      const s = window.Game.state;
      return s.lock === false && s.active === 1;
    },
    null,
    { timeout: 6000 },
  );
  const s = await page.evaluate(() => window.Game.state);
  expect(s.active).toBe(1);
  expect(s.lastMove.player).toBe(2);
  expect(s.lastMove.amount).toBeGreaterThan(0);
});

test("Ungültiger Tap: Haufenfeedback ohne Markierung", async ({ page }) => {
  // 5 Steine, 4er-Regel (max 4) → 5. Rosine tippen ist illegal.
  await configureApp(page, {
    minStones: 5,
    maxStones: 5,
    rule: "4er",
    opponent: "Mensch",
    start: "1",
  });
  await page.locator("#start-go-btn").click();

  await pointerTap(page, 4, 0);
  // Keine laufende Markierung, kein Zug — aber Feedback am Haufen.
  const s = await page.evaluate(() => window.Game.state);
  expect(s.selectedAmount).toBeNull();
  expect(s.heaps).toEqual([5]);
  expect(s.lastMove).toBeNull();
  await expect(page.locator("#take-btn")).toBeDisabled();
  await expect(
    page.locator(".heap[data-heap-index='0'] .heap-feedback"),
  ).toContainText("Nur 1, 2, 3, 4");
  // Feedback verschwindet von allein (~1,6 s) — kein klemmender Lock.
  await page.waitForFunction(
    () => !document.querySelector(".heap[data-heap-index='0'] .heap-feedback"),
    null,
    { timeout: 5000 },
  );
});

test("Neue Auswahl ersetzt / Escape bricht ab", async ({ page }) => {
  await configureApp(page, {
    minStones: 4,
    maxStones: 4,
    rule: "4er",
    opponent: "Mensch",
    start: "1",
  });
  await page.locator("#start-go-btn").click();

  // Markierung 3 …
  await pointerTap(page, 2, 0);
  await expect(
    page.locator('.heap[data-heap-index="0"] .stone.selected'),
  ).toHaveCount(3);
  let s = await page.evaluate(() => window.Game.state);
  expect(s.selectedAmount).toBe(3);
  // … wird durch Markierung 1 ersetzt.
  await pointerTap(page, 0, 0);
  await expect(
    page.locator('.heap[data-heap-index="0"] .stone.selected'),
  ).toHaveCount(1);
  s = await page.evaluate(() => window.Game.state);
  expect(s.selectedAmount).toBe(1);
  await expect(page.locator("#take-btn")).toBeEnabled();

  // Escape bricht ab und räumt die Markierung ab.
  await page.keyboard.press("Escape");
  await expect(page.locator(".stone.selected")).toHaveCount(0);
  s = await page.evaluate(() => window.Game.state);
  expect(s.selectedAmount).toBeNull();
  expect(s.heaps).toEqual([4]);
  expect(s.lastMove).toBeNull();
  await expect(page.locator("#take-btn")).toBeDisabled();
});

test("Leerer Haufe, Sieg-Overlay und Neustart", async ({ page }) => {
  await configureApp(page, {
    minStones: 1,
    maxStones: 1,
    rule: "classic",
    opponent: "Mensch",
    start: "1",
  });
  await page.locator("#start-go-btn").click();

  // Einzige Rosine markieren + nehmen → letzte Rosine → Sieg.
  await pointerTap(page, 0, 0);
  await page.locator("#take-btn").click();
  await expect(page.locator("#win-overlay")).toBeVisible({ timeout: 6000 });
  await expect(page.locator("#win-title")).toContainText("hat gewonnen");

  const s = await page.evaluate(() => window.Game.state);
  expect(s.heaps).toEqual([0]);

  // Neustart via Overlay: frische Runde wartet wieder auf Los!.
  await page.locator("#new-game-btn").click();
  await expect(page.locator("#win-overlay")).toBeHidden();
  await expect(page.locator("#start-overlay")).toBeVisible();
});
