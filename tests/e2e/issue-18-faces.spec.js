"use strict";
// Issue #18: KI-Gesichter — nur Baxi reagiert positionsspezifisch.
//
//   Alle drei KI:  🤔-Nachdenk-Gesicht + "…denkt…" (Timeout ~0,6–0,9 s)
//                  bleibt unverändert.
//   Baxi:          Gewinnposition (NIM-Summe != 0)   -> 😆 + Lach-Blase
//                  Verliererposition (NIM-Summe = 0) -> 😠 + Ärger-Blase
//                  (bestehendes Verhalten, bleibt wie bisher)
//   Ducola/Muisa:  IMMER ihr freundliches Idle-Gesicht (😺 / 😸),
//                  egal wie die Stellung steht.
//
// Methodik (deterministisch):
//   1. Ausgangsposition per App-API fixiert, s.active=2 und lastMove =
//      Mensch-Zug gesetzt -> der echte KI-Pfad (maybeAIMove) laeuft.
//   2. Game.setBubble wird in der Seite gewrappelt (Paare-Log:
//      [bubbleText, face-at-call-time]) — faengt auch die kurzlebigen
//      Laune-Blasen, die die Zaehl-Animation ("🐇s…") sofort
//      ueberschreibt (Issue #7, bestehendes Verhalten).
//   3. Das Gesicht der KI-Karte wird zusaetzlich alle 40 ms gestichprobt
//      (die Laune-Gesichter bleiben lange stehen — bestehendes Verhalten).
//   4. Legitime Blasen (NICHT Laune): "…denkt…", Zaehl-Blasen
//      ("Eins…", "…  — Nimm!") und die Sieg-/Niederlagen-Blasen
//      (AI_WIN_LINES / AI_LOSE_LINES — Game-Ende, bestehende Logik).
//      GEMESSEN wird genau die Laune: AI_LAUGH_LINES / AI_ANGRY_LINES
//      (exakte Zeilen aus game.js), gepaart mit dem Gesicht zum
//      Setzzeitpunkt.

const { test, expect } = require("@playwright/test");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const APP_URL = pathToFileURL(
  path.resolve(__dirname, "..", "..", "index.html"),
).href;

// Exakte Laune-Zeilen aus game.js (AI_LAUGH_LINES / AI_ANGRY_LINES).
const LAUGH_LINE =
  /^(Hahaha! Aha, da machst du mal einen Fehler!|Oha, oha, oha! So nicht!|Du hast mir gerade eine Rosine geschenkt!)/;
const ANGRY_LINE =
  /^(Uuugh, das stinkt!|Hmpf! Du hast doch die ganze Zeit schon gewonnen|Nicht lustig! Das ist kein Fair-Play!|Ugh, meine Rosinen! Warum immer ich!)/;

// Alles andere ist legitim (Zaehlen, "…denkt…", Sieg/Niederlage-Texte).
function isLegitBubble(b) {
  if (!b) {
    return true;
  }
  if (LAUGH_LINE.test(b) || ANGRY_LINE.test(b)) {
    return false; // Laune!
  }
  return true;
}

async function configureApp(page, opponent) {
  await page.locator("#options-btn").click();
  await expect(page.locator("#options-dialog")).toBeVisible();
  await page.locator("#opt-max-heaps").fill("2");
  await page.locator("#opt-min-stones").fill("1");
  await page.locator("#opt-max-stones").fill("3");
  await page.locator(`input[name="opt-opponent"][value="${opponent}"]`).check();
  await page.locator('input[name="opt-start"][value="1"]').check();
  await page.locator("#opt-apply").click();
  await expect(page.locator("#options-dialog")).toBeHidden();
  await page.locator("#start-go-btn").click();
  await expect(page.locator("#start-overlay")).toBeHidden();
}

async function setHeaps(page, heaps) {
  await page.evaluate((h) => {
    const s = window.Game.state;
    s.heaps = h;
    s.active = 1;
    s.lastMove = null;
    s.pendingAmount = null;
    s.selectedAmount = null;
    s.lock = false;
    s.faces = null;
    s.bubble = {};
    s.selectedHeap = 0;
    window.Game.render();
    window.Game.renderCharacters();
    window.Game.renderAmountSelection();
    window.Game.renderTakeButton();
  }, heaps);
}

// Startet den echten KI-Pfad und erfasst alle Blasen (mit Paar-Gesicht)
// + die Gesichtsausdruck des Spielers-KI-Karte fuer maxMs.
// Returns { faces: [..], paired: [{ text, face }, ..] }
async function captureAISequence(page, maxMs) {
  await page.evaluate(() => {
    window.__log = [];
    const origBubble = window.Game.setBubble;
    window.Game.setBubble = (p, text) => {
      const cur = window.Game.state && window.Game.state.faces;
      window.__log.push({ text: text, face: cur ? cur[2] : null });
      return origBubble(p, text);
    };
    window.Game.state.lastMove = { player: 1, heapIdx: 0, amount: 1 };
    window.Game.state.active = 2;
    window.Game.maybeAIMove();
  });
  const faces = await page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const out = [];
        const t0 = Date.now();
        const iv = setInterval(() => {
          const s = window.Game && window.Game.state;
          if (s && s.faces) {
            out.push(s.faces[2] || null);
          }
          if (Date.now() - t0 >= ms) {
            clearInterval(iv);
            resolve(out);
          }
        }, 40);
      }),
    maxMs,
  );
  const log = await page.evaluate(() => window.__log.slice());
  return { faces: faces, paired: log };
}

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (err) => {
    throw new Error("pageerror in App: " + (err && err.message));
  });
  await page.goto(APP_URL, { waitUntil: "load" });
});

test("Baxi: wuetend 😠 + Aergert-Blase in VERLIERERposition (Issue #18)", async ({
  page,
}) => {
  await configureApp(page, "Baxi");
  // [2,2]: N = 2 XOR 2 = 0 -> Verliererposition fuer die am Zug (KI).
  await setHeaps(page, [2, 2]);
  const nim = await page.evaluate(() => window.Nim.nimSum([2, 2], null));
  expect(nim, "voraugesetzte VERLIERERposition [2,2]").toBe(0);

  const { faces, paired } = await captureAISequence(page, 6000);
  const uniq = Array.from(new Set(faces));

  // 🤔-Phase: alle drei KI, unveraendert.
  expect(uniq, "erwartet 🤔-Phase").toContain("🤔");
  // 😠-Gesicht MUSS beobachtet werden (best. Baxi-Verhaltend).
  expect(uniq, "erwartet 😠: " + JSON.stringify(uniq)).toContain("😠");
  // 😆 dar in VERLIERERposition NICHT (best. Baxi-Verhaltend).
  expect(uniq, "sollte 😆 NICHT haben").not.toContain("😆");

  // Mindestens eine Aergert-Blase, die ZEGLEICH mit 😠 gesetzt
  // wurde (Face + Blase werden im selbe Takt gesetzt — game.js).
  const angryPaired = paired.filter(
    (p) => p.face === "😠" && ANGRY_LINE.test(p.text),
  );
  expect(
    angryPaired.length,
    "Baxi ohne Aergert-Blase (gepaart bei 😠); alle Paare: " +
      JSON.stringify(paired),
  ).toBeGreaterThan(0);
});

test("Baxi: hoehnisch 😆 + Lach-Blase in GEWINNposition (Issue #18)", async ({
  page,
}) => {
  await configureApp(page, "Baxi");
  // [3,1]: N = 3 XOR 1 = 2 != 0 -> Gewinnposition fuer die am Zug (KI).
  await setHeaps(page, [3, 1]);
  const nim = await page.evaluate(() => window.Nim.nimSum([3, 1], null));
  expect(nim, "voraugesetzte GEWINNposition [3,1]").not.toBe(0);

  const { faces, paired } = await captureAISequence(page, 6000);
  const uniq = Array.from(new Set(faces));

  expect(uniq, "erwartet 🤔-Phase").toContain("🤔");
  expect(uniq, "erwartet 😆: " + JSON.stringify(uniq)).toContain("😆");
  expect(uniq, "sollte 😠 NICHT haben").not.toContain("😠");

  const laughingPaired = paired.filter(
    (p) => p.face === "😆" && LAUGH_LINE.test(p.text),
  );
  expect(
    laughingPaired.length,
    "Baxi ohne Lach-Blase (gepaart bei 😆); alle Paare: " +
      JSON.stringify(paired),
  ).toBeGreaterThan(0);
});

test("Ducola/Muisa: IMMER freundlich (😺/😸), keine Laune (Issue #18)", async ({
  page,
}) => {
  test.setTimeout(120000);
  for (const c of [
    { opp: "Ducola", idle: "😺" },
    { opp: "Muisa", idle: "😸" },
  ]) {
    for (const [pos, label] of [
      [[2, 2], "VERLIERER"],
      [[3, 1], "GEWINN"],
    ]) {
      // Frischer Lauf: neu laden fuer sauberen Zustand.
      await page.goto(APP_URL, { waitUntil: "load" });
      await configureApp(page, c.opp);
      await setHeaps(page, pos);

      const { faces, paired } = await captureAISequence(page, 6000);
      const uniq = Array.from(new Set(faces));

      // 🤔-Phase: bleibt unveraendert (alle drei KI).
      expect(uniq, c.opp + " " + label + ": erwartet 🤔-Phase").toContain("🤔");

      // NIE ein Laune-Gesicht — egal wie die Stellung steht.
      expect(uniq, c.opp + " " + label + ": unerwartet 😆").not.toContain("😆");
      expect(uniq, c.opp + " " + label + ": unerwartet 😠").not.toContain("😠");

      // IMMER das freundlich Idle-Gesicht (bzw. 🤔 bzw. null).
      expect(uniq, c.opp + " " + label + ": erwartet " + c.idle).toContain(
        c.idle,
      );
      expect(
        uniq.every((f) => f === c.idle || f === null || f === "🤔"),
        c.opp +
          " " +
          label +
          ": nur " +
          c.idle +
          " / 🤔 erlaubt: " +
          JSON.stringify(uniq),
      ).toBe(true);

      // NIE eine Laune-Blase (exakte AI_LAUGH_LINES / AI_ANGRY_LINES).
      const laune = paired.filter(
        (p) => !isLegitBubble(p.text) && p.face !== null,
      );
      expect(
        laune,
        c.opp + " " + label + " hatte Laune-Blasen: " + JSON.stringify(laune),
      ).toEqual([]);
    }
  }
});
