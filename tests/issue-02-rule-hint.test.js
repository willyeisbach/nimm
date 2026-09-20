"use strict";

// Issue #2: Die aktuelle Zugregel steht dauerhaft, gut lesbar auf dem
// Spielfeld (nicht nur im Options-Dialog). Drei Regelfälle + Pflichtteile
// („nur aus einem Haufen", „Wer die letzte nimmt, gewinnt") und dass sich
// der Text der aktualisierten Regel anpasst (AK2 über applyOptions → start()).
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// --- AK (Markup): element id="rule-hint" im Spielfeld vorhanden -------------
const indexHtml = fs.readFileSync(
  path.join(__dirname, "..", "index.html"),
  "utf8",
);
assert.ok(
  indexHtml.indexOf('id="rule-hint"') !== -1,
  "index.html: #rule-hint must exist on the board",
);

// --- DOM-Mock mit #rule-hint ------------------------------------------------
function makeClassList() {
  const classes = new Set();
  return {
    add(name) {
      classes.add(name);
    },
    remove(name) {
      classes.delete(name);
    },
    toggle(name) {
      return classes.has(name);
    },
    contains(name) {
      return classes.has(name);
    },
  };
}

function element(extra) {
  const attributes = {};
  const listeners = {};
  const el = {
    textContent: "",
    value: "",
    checked: false,
    hidden: false,
    disabled: false,
    classList: makeClassList(),
    setAttribute(n, v) {
      attributes[n] = String(v);
    },
    getAttribute(n) {
      return attributes[n] === undefined ? null : attributes[n];
    },
    addEventListener(n, h) {
      listeners[n] = h;
    },
    appendChild() {},
    focus() {},
  };
  return Object.assign(el, extra || {});
}

const ruleHintEl = element();
const generic = element({
  querySelectorAll() {
    return [];
  },
  querySelector() {
    return null;
  },
});
const document = {
  readyState: "loading",
  querySelector(selector) {
    if (selector === "#rule-hint") {
      return ruleHintEl;
    }
    if (selector === "#heaps") {
      return generic;
    }
    return element({ value: "", checked: false }); // Options-Felder generisch
  },
  querySelectorAll() {
    return [];
  },
  createElement() {
    return element();
  },
  addEventListener() {},
  contains() {
    return true;
  },
};

function loadGame() {
  const window = {
    Game: {},
    Nim: {
      parseAllowed(rule, ownList) {
        if (rule === "classic") {
          return null;
        }
        if (rule === "4er") {
          return [1, 2, 3, 4];
        }
        // ownList: kommagetrennte Zahlen → Array
        return String(ownList)
          .split(",")
          .map(function (x) {
            return parseInt(x, 10);
          })
          .filter(function (n) {
            return n > 0;
          });
      },
      legalAmount() {
        return true;
      },
    },
    AI: {
      chooseMove() {
        return { heapIdx: 0, amount: 1 };
      },
    },
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
    setTimeout: function () {
      return {};
    },
    clearTimeout: function () {},
  };
  // crypto für randomInt: determinischer Pseudo-Source
  context.window.crypto = {
    getRandomValues(buf) {
      for (let i = 0; i < buf.length; i++) {
        buf[i] = 42;
      }
      return buf;
    },
  };
  window.crypto = context.window.crypto;
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8"),
    context,
    { filename: "game.js" },
  );
  return window.Game;
}

function setup(Game, rule, ownList) {
  const s = Game.state;
  s.maxHaufen = 1;
  s.rule = rule;
  s.maxSteine = 12;
  s.minSteine = 8;
  s.opponent = "Mensch";
  s.name1 = "Spieler 1";
  s.name2 = "Spieler 2";
  s.startPlayer = "1";
  s.undoEnabled = false;
  s.ownList = ownList;
  s.active = 1;
  s.heaps = [9];
  s.allowed = Game.state.allowed = null;
  // Game.start() nutzen, aber die KI-Logik neutralisieren, damit nur der
  // Rule-Hint-Pfad läuft.
  Game.maybeAIMove = function () {};
  Game.render = function () {};
  Game.renderUndoButton = function () {};
  Game.renderRuleHint = Game.renderRuleHint;
  Game.start();
}

// --- AK1: Default 4er-Nimm → 1–4-Regel ohne Options-Dialog ------------------
(function ak1() {
  const Game = loadGame();
  Game.state.rule = "4er";
  setup(Game, "4er", undefined);
  const text = ruleHintEl.textContent;
  assert.ok(
    /1,\s*2,\s*3\s+oder\s+4/.test(text),
    "4er-Regel: 1,2,3 oder 4 genannt. Got: " + text,
  );
  assert.ok(
    /einem Haufen/.test(text),
    "«nur aus einem Haufen» muss enthalten sein. Got: " + text,
  );
  assert.ok(
    /letzte nimmt, gewinnt/i.test(text),
    "«letzte gewinnt» muss enthalten sein. Got: " + text,
  );
  assert.ok(
    /Grundy|Mod-4|Bitparität|NIM/.test(text) === false,
    "keine Fachbegriffe (Grundy/Mod/NIM). Got: " + text,
  );
})();

// --- AK2: Klassisch → „so viele ..., wie du willst" ------------------------
(function ak2() {
  const Game = loadGame();
  setup(Game, "classic", undefined);
  const text = ruleHintEl.textContent;
  assert.ok(
    /so viele/.test(text),
    "Klassisch: 'so viele' muss vorkommen. Got: " + text,
  );
  assert.ok(
    /1,\s*2,\s*3\s+oder\s+4/.test(text) === false,
    "Klassisch soll nicht die 4er-Liste nennen. Got: " + text,
  );
  assert.ok(
    /einem Haufen/.test(text),
    "«nur aus einem Haufen» muss enthalten sein.",
  );
})();

// --- AK2: eigene Liste {1,3,5} → genau diese Zahlen -------------------------
(function ak3() {
  const Game = loadGame();
  setup(Game, "own", "1,3,5");
  const text = ruleHintEl.textContent;
  assert.ok(
    /1,\s*3\s+oder\s+5/.test(text),
    "Eigene Liste: 1,3 oder 5 genannt. Got: " + text,
  );
  assert.ok(
    /einem Haufen/.test(text),
    "«nur aus einem Haufen» muss enthalten sein.",
  );
})();

// --- AK2: Wechsel aktualisiert den Text (applyOptions-Pfad: apply→start) ----
// Der Test ruft Game.start() erneut auf, wie es applyOptions tut (Z1497),
// und prüft, dass der hint dem neuen Regle-Zustand folgt, nicht dem alten.
(function akSwitch() {
  const Game = loadGame();
  setup(Game, "own", "1,3,5");
  const before = ruleHintEl.textContent;
  assert.ok(
    /1,\s*3\s+oder\s*5/.test(before),
    "Vorher: eigene Liste. Got: " + before,
  );

  // „Änderung übernehmen" → applyOptions → s.allowed neu → start().
  // Hier simulieren wir genau den Übergang auf Klassisch:
  Game.state.rule = "classic";
  Game.state.ownList = undefined;
  Game.start();
  const after = ruleHintEl.textContent;
  assert.ok(
    /so viele/.test(after),
    "Nach Wechsel: Klassisch-Text. Got: " + after,
  );
  assert.ok(
    /1,\s*3\s+oder\s*5/.test(after) === false,
    "Nach Wechsel: die alten Listenzahlen dürfen nicht mehr stehen. Got: " +
      after,
  );
})();

console.log(
  "Issue 02 regression test passed (rule hint on the board, rule-dependent)",
);
