"use strict";

// Issue #1: Rundenstart wartet auf Nutzeraktion („Los!"), bevor die KI zieht.
// - AK1: KI beginnt → nach start() ist keine Rosine entfernt, Haufen sichtbar
// - AK2: nach confirmStart() denkt/zieht die KI (maybeAIMove wird aufgerufen)
// - AK3: Mensch beginnt → nach Los! ist executeMove frei, keine KI
// - AK4: Mensch gegen Mensch → vor Los! kein Zug; nach Los! möglich
// - AK5: kein Lock während der Wartephase (Optionen/Neue-Runde bedienbar)
// - AK6: „kein maybeAIMove vor Bestätigung"
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function makeClassList() {
  const classes = new Set();
  return {
    add(name) {
      classes.add(name);
    },
    remove(name) {
      classes.delete(name);
    },
    toggle(name, force) {
      const on = force === undefined ? !classes.has(name) : force;
      if (on) {
        classes.add(name);
      } else {
        classes.delete(name);
      }
      return on;
    },
    contains(name) {
      return classes.has(name);
    },
  };
}

function element(extra) {
  const attributes = {};
  const el = {
    hidden: false,
    disabled: false,
    textContent: "",
    value: "",
    className: "",
    dataset: {},
    classList: makeClassList(),
    setAttribute(n, v) {
      attributes[n] = String(v);
    },
    getAttribute(n) {
      return attributes[n] === undefined ? null : attributes[n];
    },
    addEventListener() {},
    querySelector() {
      return null;
    },
    appendChild() {},
  };
  return Object.assign(el, extra || {});
}

// #start-who braucht ein querySelector aus dem Overlay-Panel.
const startOverlay = element();
const startWho = element();
startOverlay.querySelector = function (sel) {
  if (sel === "#start-who") {
    return startWho;
  }
  return null;
};
const generic = element();
const document = {
  readyState: "loading",
  querySelector(selector) {
    if (selector === "#start-overlay") {
      return startOverlay;
    }
    return element();
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

function loadGame(NimImpl) {
  const window = {
    Game: {},
    Nim: NimImpl,
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
      return 0;
    },
    clearTimeout: function () {},
  };
  context.window.crypto = {
    getRandomValues(buf) {
      for (let i = 0; i < buf.length; i++) {
        buf[i] = 7;
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

const nim = {
  parseAllowed(rule) {
    return rule === "classic" ? null : [1, 2, 3, 4];
  },
  legalAmount(rule, allowed, amount, heapSize) {
    return (
      amount >= 1 &&
      amount <= heapSize &&
      (!allowed || allowed.indexOf(amount) !== -1)
    );
  },
};

function freshSetup(Game, opponent) {
  const s = Game.state;
  // Deterministische Haufen: newHeaps stubben (random-free).
  Game.newHeaps = function () {
    return [6, 4];
  };
  s.maxHaufen = 2;
  s.rule = "4er";
  s.maxSteine = 10;
  s.minSteine = 4;
  s.opponent = opponent;
  s.name1 = "Lina";
  s.name2 = opponent === "Mensch" ? "Paul" : opponent;
  s.startPlayer = opponent === "aiStarts" ? "2" : "1";
  s.startPlayer = "1"; // per Case unten überschrieben
  s.undoEnabled = false;
  // Rendering neutralisieren (Prüfung der Zustände, nicht des DOMs).
  Game.render = function () {};
  Game.renderRuleHint = function () {};
  Game.renderUndoButton = function () {};
  Game.renderStartOverlay = Game.renderStartOverlay;
  Game.animateAndRemove = function (heapIdx, amount, cb) {
    s.heaps[heapIdx] -= amount;
    cb();
  };
  Game.checkWin = function () {};
  let aiCalls = 0;
  let aiMoveRan = false;
  Game.maybeAIMove = function () {
    aiCalls += 1;
    aiMoveRan = true;
    if (Game.isAIActive()) {
      Game.animateAndRemove(0, 1, function () {
        s.lastMove = { player: 2, heapIdx: 0, amount: 1 };
        s.active = 1;
      });
    }
  };
  return {
    aiCalls: function () {
      return aiCalls;
    },
  };
}

// --- Setup-Hilfsmethode: Game.state manuell setzen, dann start() -------------
function beginRound(Game, opponentName, startPlayer) {
  const hooks = freshSetup(Game, opponentName);
  const s = Game.state;
  s.opponent = opponentName;
  s.name2 = opponentName === "Mensch" ? "Paul" : opponentName;
  s.startPlayer = startPlayer;
  s.active = startPlayer === "1" ? 1 : 2;
  Game.start();
  return hooks;
}

// --- AK1: KI beginnt → vor Los! keine Rosine weg, Haufen sichtbar ----------
(function ak1ai() {
  const Game = loadGame(nim);
  const hooks = beginRound(Game, "Baxi", "2"); // KI (Spieler 2) beginnt
  const s = Game.state;
  assert.strictEqual(s.awaitingStart, true, "AK1: Runde wartet auf Los!");
  assert.deepStrictEqual(
    s.heaps,
    [6, 4],
    "AK1: keine Rosine entfernt vor Los!",
  );
  assert.strictEqual(
    hooks.aiCalls(),
    0,
    "AK6: kein maybeAIMove vor Bestätigung",
  );
  assert.ok(!startOverlay.hidden, "AK1: Start-Panel sichtbar");
  assert.ok(
    /Baxi beginnt/.test(startWho.textContent),
    "AK: wer beginnt, wird genannt. Got: " + startWho.textContent,
  );
  assert.strictEqual(s.lock, false, "AK5: kein Lock in der Wartephase");
})();

// --- AK2: nach Los! denkt/zieht die KI -------------------------------------
(function ak2ai() {
  const Game = loadGame(nim);
  const hooks = beginRound(Game, "Baxi", "2");
  const s = Game.state;
  Game.confirmStart();
  assert.strictEqual(s.awaitingStart, false, "Los! hebt das Warten auf");
  assert.ok(startOverlay.hidden, "Start-Panel ist nach Los! versteckt");
  assert.strictEqual(hooks.aiCalls(), 1, "AK2: die KI wird nach Los! aktiv");
  assert.deepStrictEqual(s.heaps, [5, 4], "KI-Zug wurde ausgeführt (6→5)");
  assert.strictEqual(s.active, 1, "Zugwechsel zurück zum Menschen");
})();

// --- AK3: Mensch beginnt → nach Los! frei, keine KI -------------------------
(function ak3human() {
  const Game = loadGame(nim);
  const hooks = beginRound(Game, "Mensch", "1");
  const s = Game.state;
  assert.strictEqual(hooks.aiCalls(), 0, "Mensch beginnt: keine KI");
  // AK4: vor Los! läuft kein Zug (Mensch-gegen-Mensch)
  Game.commitTap(0, 2);
  assert.deepStrictEqual(s.heaps, [6, 4], "AK4: vor Los! kein Zug (MvM)");
  Game.executeMove();
  assert.deepStrictEqual(
    s.heaps,
    [6, 4],
    "AK4: executeMove vor Los! blockiert",
  );
  Game.confirmStart();
  // Nach Los! darf der Mensch sofort ziehen.
  Game.commitTap(0, 2);
  assert.deepStrictEqual(
    s.heaps,
    [4, 4],
    "AK3: nach Los! kann sofort gezogen werden (6→4)",
  );
  assert.strictEqual(s.active, 2, "Zugwechsel zu Spieler 2");
  // MvM: nur der Mensch hat gezogen (Zug 1, Spieler 1) — die KI ist still.
  assert.strictEqual(
    s.lastMove.player,
    1,
    "AK3: MvM — der Zug gehört Spieler 1, nicht der KI",
  );
  assert.strictEqual(s.lastMove.amount, 2, "AK3: der Mensch hat 2 genommen");
})();

// --- AK5: Wartephase ist kein Lock — Neustart bleibt möglich ----------------
(function ak5restart() {
  const Game = loadGame(nim);
  beginRound(Game, "Mensch", "1");
  const s = Game.state;
  assert.strictEqual(s.lock, false, "AK5: kein Lock in der Wartephase");
  // „Neue Runde" setzt das Warten wieder an (und ändert den Start).
  Game.state.startPlayer = "2";
  Game.newGame();
  assert.strictEqual(
    Game.state.awaitingStart,
    true,
    'Neue Runde stellt erneut auf "Los!"-Warten um',
  );
  assert.strictEqual(
    Game.state.lock,
    false,
    "AK5: Neustart setzt ebenfalls kein Lock",
  );
})();

console.log("Issue 01 regression test passed (round start waits for Los!)");
