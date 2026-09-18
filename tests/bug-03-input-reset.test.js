"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function makeClassList() {
  const classes = new Set();
  return {
    add(name) { classes.add(name); },
    remove(name) { classes.delete(name); },
    toggle(name, force) {
      const enabled = force === undefined ? !classes.has(name) : force;
      if (enabled) {
        classes.add(name);
      } else {
        classes.delete(name);
      }
      return enabled;
    },
    contains(name) { return classes.has(name); }
  };
}

function makeElement() {
  const attributes = {};
  const listeners = {};
  const element = {
    disabled: false,
    hidden: true,
    textContent: "",
    value: "1",
    dataset: {},
    classList: makeClassList(),
    setAttribute(name, value) { attributes[name] = String(value); },
    getAttribute(name) {
      return attributes[name] === undefined ? null : attributes[name];
    },
    addEventListener(name, handler) { listeners[name] = handler; },
    dispatch(name) {
      if (listeners[name]) {
        listeners[name]();
      }
    },
    appendChild() {},
    querySelectorAll() { return []; },
    remove() { this.removed = true; },
    focus() {}
  };
  return element;
}

const drawButton = makeElement();
const input = makeElement();
const error = makeElement();
const activePlayer = makeElement();
const lastMove = makeElement();
const overlay = makeElement();
const heapsContainer = makeElement();
const heap = makeElement();
heap.dataset.heapIndex = "0";
const stones = [makeElement(), makeElement(), makeElement()];
heap.querySelectorAll = function (selector) {
  if (selector === ".stone") {
    return stones;
  }
  if (selector === ".stone.blinking") {
    return stones.filter((stone) => stone.classList.contains("blinking"));
  }
  return [];
};

const timers = [];
const document = {
  readyState: "loading",
  querySelector(selector) {
    const elements = {
      "#draw-btn": drawButton,
      "#amount-input": input,
      "#input-error": error,
      "#active-player": activePlayer,
      "#last-move": lastMove,
      "#win-overlay": overlay,
      "#heaps": heapsContainer,
      '#heaps .heap[data-heap-index="0"]': heap
    };
    return elements[selector] || null;
  },
  querySelectorAll(selector) {
    return selector === "#heaps .heap" ? [heap] : [];
  },
  createElement() { return makeElement(); },
  addEventListener() {},
  contains() { return true; }
};
const window = {
  Game: {},
  Nim: {
    parseAllowed() { return null; },
    legalAmount(rule, allowed, amount, heapSize) {
      return amount >= 1 && amount <= heapSize;
    }
  },
  AI: {
    chooseMove() { return { heapIdx: 0, amount: 1 }; }
  }
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
  }
};

vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8"),
  context,
  { filename: "game.js" }
);

const Game = window.Game;
Game.checkWin = function () {};
Game.state.heaps = [3];
Game.state.selectedHeap = 0;
Game.state.active = 1;
Game.state.opponent = "Mensch";
Game.state.lock = false;
input.value = "1";

// Real executeMove/animateAndRemove path: the post-move input must be empty.
Game.executeMove();
assert.strictEqual(Game.isLocked(), true, "the move must lock while animating");
stones[2].dispatch("animationend");
assert.strictEqual(input.value, "", "a completed move must clear the input");
assert.strictEqual(error.hidden, true, "an empty reset must not show an input error after render");
assert.strictEqual(Game.readAmount(), null, "an empty reset must remain invalid until new input");
Game.updateButtonState();
assert.strictEqual(drawButton.disabled, true, "an empty reset must keep the draw button disabled");
input.value = "1";
assert.strictEqual(Game.validateInput(), true, "a newly entered legal amount must validate");
assert.strictEqual(Game.state.selectedHeap, 0, "a single heap remains selected automatically");
assert.strictEqual(Game.state.active, 2, "the turn must pass to the other player");

// newGame must use the same reset semantics without changing configuration.
input.value = "4";
overlay.hidden = false;
let startCalls = 0;
const originalStart = Game.start;
Game.start = function () { startCalls += 1; };
Game.newGame();
assert.strictEqual(input.value, "", "newGame must clear the input");
assert.strictEqual(overlay.hidden, true, "newGame must hide the win overlay");
assert.strictEqual(startCalls, 1, "newGame must restart the game");
Game.start = originalStart;

// The AI callback is another completed-move path and must stay consistent.
Game.animateAndRemove = function (heapIdx, amount, cb) {
  Game.state.heaps[heapIdx] -= amount;
  Game.state.lock = false;
  input.disabled = false;
  cb();
};
Game.state.heaps = [2];
Game.state.selectedHeap = 0;
Game.state.active = 2;
Game.state.opponent = "Baxi";
Game.state.lock = false;
input.value = "1";
Game.maybeAIMove();
const aiTimer = timers[timers.length - 1];
aiTimer();
assert.strictEqual(input.value, "", "an AI move must also clear the input");

console.log("Bug 03 regression test passed");
