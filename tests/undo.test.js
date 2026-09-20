"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function makeElement() {
  const attributes = {};
  const listeners = {};
  const classes = new Set();
  return {
    disabled: false,
    hidden: true,
    textContent: "",
    value: "1",
    dataset: {},
    classList: {
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      },
      toggle(name, force) {
        if (force === undefined ? !classes.has(name) : force) {
          classes.add(name);
          return true;
        }
        classes.delete(name);
        return false;
      },
      contains(name) {
        return classes.has(name);
      },
    },
    setAttribute(name, value) {
      attributes[name] = String(value);
    },
    getAttribute(name) {
      return attributes[name] === undefined ? null : attributes[name];
    },
    removeAttribute(name) {
      delete attributes[name];
    },
    addEventListener(name, handler) {
      listeners[name] = handler;
    },
    appendChild() {},
    querySelectorAll() {
      return [];
    },
    closest() {
      return null;
    },
    remove() {},
    focus() {},
  };
}

const undoBtn = makeElement();
const newRoundBtn = makeElement();
const overlay = makeElement();
const heapsContainer = makeElement();
const heap = makeElement();
const stone = makeElement();
const charWrap = makeElement();

heap.dataset.heapIndex = "0";
heap.querySelectorAll = function (selector) {
  return selector === ".stone" ? [stone] : [];
};
stone.addEventListener = function () {};

const elements = {
  "#undo-btn": undoBtn,
  "#new-round-btn": newRoundBtn,
  "#win-overlay": overlay,
  "#characters": charWrap,
  "#heaps": heapsContainer,
  '#heaps .heap[data-heap-index="0"]': heap,
};

const timers = [];
const document = {
  readyState: "loading",
  querySelector(selector) {
    return elements[selector] || null;
  },
  querySelectorAll(selector) {
    if (selector === "#heaps .heap") {
      return [heap];
    }
    if (selector === ".char-card") {
      return [charWrap];
    }
    return [];
  },
  createElement() {
    return makeElement();
  },
  addEventListener() {},
  contains() {
    return true;
  },
};
const window = {
  Game: {},
  crypto: {
    getRandomValues(buffer) {
      buffer[0] = 0x1234;
      return buffer;
    },
  },
  Nim: {
    parseAllowed() {
      return null;
    },
    legalAmount(rule, allowed, amount, heapSize) {
      return amount >= 1 && amount <= heapSize;
    },
    nimSum(position) {
      return position.reduce((s, n) => s ^ n, 0);
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
  setTimeout(fn) {
    timers.push(fn);
    return timers.length;
  },
  clearTimeout(id) {
    if (id !== undefined) {
      timers[id - 1] = null;
    }
  },
};
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8"),
  context,
  { filename: "game.js" },
);

const Game = window.Game;
Game.render = function () {};
Game.start = function () {
  Game.state.heaps = [3];
  Game.state.active = 1;
  Game.state.lastMove = null;
  Game.state.selectedHeap = 0;
  Game.state.undoStack = [];
  Game.state.lock = false;
  Game.render();
  Game.renderUndoButton();
};
Game.animateAndRemove = function (heapIdx, amount, cb) {
  Game.state.heaps[heapIdx] -= amount;
  cb();
};
Game.checkWin = function () {};
Game.maybeAIMove = function () {};
Game.state.opponent = "Mensch";
Game.state.undoEnabled = true;
Game.state.heaps = [5];
Game.state.active = 1;
Game.state.undoStack = [];
Game.state.pendingAmount = 2;

// Mensch vs Mensch: ein Zug nach dem Anderen.
Game.executeMove();
assert.deepStrictEqual(Game.state.heaps, [3], "move must subtract");
assert.deepStrictEqual(
  Game.undoStack().length,
  1,
  "one snapshot must be pushed",
);
assert.strictEqual(undoBtn.disabled, false, "undo button must be enabled");

// Undo: zurück zu 5 Steinen, S1 dran, lastMove=Zug-Vorher-Zustand.
Game.state.active = 2; // executeMove hat Spieler gewechselt
Game.state.lastMove = { player: 1, heapIdx: 0, amount: 2 };
Game.undoMove();
assert.deepStrictEqual(Game.state.heaps, [5], "undo must restore heap size");
assert.strictEqual(
  Game.state.active,
  1,
  "undo must restore the player who moved",
);
assert.strictEqual(
  undoBtn.disabled,
  true,
  "undo must be disabled when stack is empty",
);

// KI-Spiel: S1 nimmt, KI antwortet, dann wird S1s Zug rückgängig gemacht.
Game.state.opponent = "Baxi";
Game.state.undoStack = [];
Game.state.heaps = [4];
Game.state.active = 1;
Game.state.lastMove = null;
Game.state.pendingAmount = 1;
Game.executeMove(); // S1: 4→3, active=2
assert.deepStrictEqual(Game.state.heaps, [3]);
assert.strictEqual(Game.state.active, 2);
Game.state.pendingAmount = 1;
Game.executeMove(); // S2 (KI): 3→2, active=1
assert.deepStrictEqual(Game.state.heaps, [2]);
assert.strictEqual(Game.state.active, 1);
assert.strictEqual(Game.undoStack().length, 2);

// Undo im KI-Modus: Mensch und KI-Antwort zurückrollen, Mensch dran.
Game.state.active = 2;
Game.undoMove();
assert.deepStrictEqual(
  Game.state.heaps,
  [4],
  "AI undo must roll back AI + human move",
);
assert.strictEqual(Game.state.active, 1, "AI undo must hand back to the human");
assert.strictEqual(
  Game.undoStack().length,
  0,
  "AI undo must drain the whole stack",
);
assert.strictEqual(
  undoBtn.disabled,
  true,
  "undo must disable after stack is drained",
);

// Undo-Deaktivierung → Button bleibt trotz Einträgen gesperrt.
Game.state.undoEnabled = false;
Game.state.heaps = [2];
Game.state.active = 1;
Game.pushHistory();
assert.strictEqual(
  undoBtn.disabled,
  true,
  "undo must stay disabled when the option is off",
);
Game.undoMove(); // muss no-op sein
assert.deepStrictEqual(
  Game.state.heaps,
  [2],
  "undo must not move when disabled",
);
assert.strictEqual(
  Game.undoStack().length,
  1,
  "the snapshot must stay on the stack",
);

// Undo wird während Lock ignoriert.
Game.state.undoEnabled = true;
Game.state.lock = true;
Game.undoMove();
assert.deepStrictEqual(
  Game.state.heaps,
  [2],
  "undo must be ignored while locked",
);
Game.state.lock = false;

console.log("Undo regression test passed");
