"use strict";

// Issue #6: Spielernamen vor der ersten Runde setzen (ohne Persistenz)
// - AK1: Nach Laden mit Defaults erscheint die Namensfrage, bevor Züge laufen
// - AK2: Bestätigte Namen stehen auf den Karten (renderCharacters)
// - AK3: KI-Gegner: Name = Baxi/Ducola/Muisa (vorgegeben, gilt als gesetzt)
// - Names-Ask zeigt ein Feld pro Spieler, wenn ein Name noch der Default ist
// - confirmStart() übernimmt eingegebene Namen ins State
// - Kein localStorage (Nicht-tun)
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function makeClassList() {
  const a = new Set();
  return {
    add(n) { a.add(n); },
    remove(n) { a.delete(n); },
    toggle(n, f) { f === undefined ? !a.has(n) && a.add(n) || a.delete(n) : (f ? a.add(n) : a.delete(n)); return a.has(n); },
    contains(n) { return a.has(n); }
  };
}

function element(extra) {
  const attributes = {};
  const listeners = {};
  const el = {
    hidden: false,
    disabled: false,
    textContent: "",
    value: "",
    className: "",
    dataset: {},
    classList: makeClassList(),
    setAttribute(n, v) { attributes[n] = String(v); },
    getAttribute(n) { return attributes[n] === undefined ? null : attributes[n]; },
    addEventListener(n, h) { listeners[n] = h; },
    querySelector() { return null; },
    appendChild() {}
  };
  return Object.assign(el, extra || {});
}

// Build a minimal overlay + name-field tree that renderStartOverlay drives.
function buildStartOverlay() {
  const name1 = element();
  const name2 = element();
  const who   = element();
  const names = element();
  const overlay = element();
  overlay.querySelector = function (sel) {
    if (sel === "#start-name1") { return name1; }
    if (sel === "#start-name2") { return name2; }
    if (sel === "#start-who")   { return who; }
    if (sel === "#start-names") { return names; }
    return null;
  };
  return { overlay, name1, name2, who, names };
}

function loadGame(NimImpl, overlayRef) {
  const generic = element();
  const document = {
    readyState: "loading",
    querySelector(selector) {
      if (selector === "#start-overlay") { return overlayRef; }
      return generic;
    },
    querySelectorAll() { return []; },
    createElement() { return element(); },
    addEventListener() {},
    contains() { return true; }
  };
  const window = {
    Game: {},
    Nim: NimImpl,
    AI: { chooseMove() { return { heapIdx: 0, amount: 1 }; } }
  };
  const context = {
    window,
    document,
    console,
    Math,
    Number,
    Array,
    Uint32Array,
    parseInt,
    setTimeout: function () { return 0; },
    clearTimeout: function () {}
  };
  context.window.crypto = {
    getRandomValues(buf) { for (let i = 0; i < buf.length; i++) { buf[i] = 3; } return buf; }
  };
  window.crypto = context.window.crypto;
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8"),
    context,
    { filename: "game.js" }
  );
  return window.Game;
}

const nim = {
  parseAllowed(rule) { return rule === "classic" ? null : [1, 2, 3, 4]; },
  legalAmount() { return true; }
};

function newRound(Game, opponent, name1, name2) {
  const s = Game.state;
  Game.newHeaps = function () { return [5, 3]; };
  s.rule = "4er";
  s.maxHaufen = 2;
  s.maxSteine = 8;
  s.minSteine = 3;
  s.opponent = opponent;
  s.name1 = name1;
  s.name2 = name2;
  s.startPlayer = "1";
  s.active = 1;
  // neutralize render/anim side-effects
  Game.render = function () {};
  Game.renderRuleHint = function () {};
  Game.renderUndoButton = function () {};
  Game.renderCharacters = function () {};
  Game.animateAndRemove = function (h, a, cb) { s.heaps[h] -= a; cb(); };
  Game.checkWin = function () {};
  Game.maybeAIMove = function () {};
  Game.start();
}

// --- AK1: Namensfrage erscheint mit Defaults, bevor Züge möglich sind ------
(function namesQuestionOnDefaults() {
  const { overlay, name1, name2, names } = buildStartOverlay();
  const Game = loadGame(nim, overlay);
  Game.state.name1 = "Spieler 1";
  Game.state.name2 = "Spieler 2";
  Game.state.opponent = "Mensch";
  newRound(Game, "Mensch", "Spieler 1", "Spieler 2");

  assert.strictEqual(overlay.hidden, false, "Start-Panel ist sichtbar");
  assert.strictEqual(names.hidden, false, "Names-Felder sind sichtbar (Defaults)");
  assert.strictEqual(name1.value, "Spieler 1", "Feld 1 zeigt den Default");
  assert.strictEqual(name2.value, "Spieler 2", "Feld 2 zeigt den Default");
  assert.strictEqual(Game.state.awaitingStart, true, "AK1: noch kein Zug möglich");
  // Züge blockiert vor Los!
  const before = Game.state.heaps.slice();
  Game.commitTap(0, 2);
  assert.deepStrictEqual(Game.state.heaps, before, "Zug blockiert vor Los!");
})();

// --- AK2: Bestätigte Namen gehen ins State (und damit auf die Karten) ------
(function namesApplied() {
  const { overlay, name1, name2 } = buildStartOverlay();
  const Game = loadGame(nim, overlay);
  Game.state.name1 = "Spieler 1";
  Game.state.name2 = "Spieler 2";
  Game.state.opponent = "Mensch";
  newRound(Game, "Mensch", "Spieler 1", "Spieler 2");
  // User tippt Namen ins Feld
  name1.value = "Lina";
  name2.value = "Paul";
  Game.confirmStart();

  assert.strictEqual(Game.state.name1, "Lina", "Name 1 übernommen");
  assert.strictEqual(Game.state.name2, "Paul", "Name 2 übernommen");
  assert.strictEqual(Game.state.awaitingStart, false, "Los! hebt das Warten auf");
  assert.strictEqual(overlay.hidden, true, "Panel ist nach Los! weg");
})();

// --- AK3: KI-Gegner → Charakternamen wird vorgegeben und zählt als gesetzt --
(function aiNameSet() {
  const { overlay, name1, name2 } = buildStartOverlay();
  const Game = loadGame(nim, overlay);
  // Mensch hat noch den Default (→ wird gefragt), Gegner ist KI = Baxi.
  Game.state.name1 = "Spieler 1";
  Game.state.name2 = "Spieler 2";
  Game.state.opponent = "Baxi";
  newRound(Game, "Baxi", "Spieler 1", "Spieler 2");

  // Mensch (Feld 1) wird gefragt; KI (Feld 2) wird mit Baxi vorbelegt.
  assert.strictEqual(name1.value, "Spieler 1", "Feld 1 zeigt den Human-Default");
  assert.strictEqual(name2.value, "Baxi", "AK3: KI-Namen wird in Feld 2 vorgegeben");
  name1.value = "Lina";
  Game.confirmStart();
  assert.strictEqual(Game.state.name1, "Lina", "Menschenname übernommen");
  assert.strictEqual(Game.state.name2, "Baxi", "AK3: KI-Namen (Baxi) bleibt / zählt als gesetzt");
})();

// --- Names-Felder sind NICHT sichtbar, wenn bereits echte Namen da sind ----
(function noAskWhenNamesSet() {
  const { overlay, names } = buildStartOverlay();
  const Game = loadGame(nim, overlay);
  Game.state.name1 = "Lina";
  Game.state.name2 = "Muisa";
  Game.state.opponent = "Muisa";
  newRound(Game, "Muisa", "Lina", "Muisa");
  // Beide Namen sind gesetzt → Names-Felder verborgen (kein Nachfragen)
  assert.strictEqual(names.hidden, true,
    "Names-Felder bleiben verborgen, wenn beides ein echter Name ist");
  assert.strictEqual(overlay.hidden, false, "Aber das Los!-Panel selbst ist sichtbar");
})();

console.log("Issue 06 regression test passed (name setup before first round)");
