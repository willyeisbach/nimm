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
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      toggle(name, force) {
        if (force === undefined ? !classes.has(name) : force) {
          classes.add(name);
          return true;
        }
        classes.delete(name);
        return false;
      },
      contains(name) { return classes.has(name); }
    },
    setAttribute(name, value) { attributes[name] = String(value); },
    getAttribute(name) {
      return attributes[name] === undefined ? null : attributes[name];
    },
    addEventListener(name, handler) {
      listeners[name] = handler;
    },
    appendChild() {},
    querySelectorAll() { return []; },
    remove() {},
    focus() {}
  };
}

const drawButton = makeElement();
const input = makeElement();
const error = makeElement();
const activePlayer = makeElement();
const heapsContainer = makeElement();
const heap = makeElement();
const stone = makeElement();
const timers = [];
let nextRandomValue = 0;

heap.dataset.heapIndex = "0";
heap.querySelectorAll = function (selector) {
  return selector === ".stone" ? [stone] : [];
};
stone.addEventListener = function () {};

const document = {
  readyState: "loading",
  querySelector(selector) {
    const elements = {
      "#draw-btn": drawButton,
      "#amount-input": input,
      "#input-error": error,
      "#active-player": activePlayer,
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
  crypto: {
    getRandomValues(buffer) {
      buffer[0] = nextRandomValue;
      return buffer;
    }
  },
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
Game.state.heaps = [3];
Game.state.selectedHeap = 0;
Game.state.active = 1;
Game.state.opponent = "Mensch";
Game.state.lock = false;
input.value = "1";

Game.updateButtonState();
assert.strictEqual(drawButton.disabled, false, "valid input must enable an unlocked button");
assert.strictEqual(drawButton.getAttribute("aria-disabled"), "false");
assert.strictEqual(error.hidden, true, "valid input must hide the error");

input.value = "0";
Game.updateButtonState();
assert.strictEqual(drawButton.disabled, true, "invalid input must disable an unlocked button");
assert.strictEqual(drawButton.getAttribute("aria-disabled"), "true");
assert.strictEqual(error.hidden, false, "invalid input must show the error");

input.value = "1";
Game.animateAndRemove(0, 1, function () {});
assert.strictEqual(Game.isLocked(), true, "animation must set the game lock");
assert.strictEqual(drawButton.disabled, true, "button must be disabled during animation lock");
assert.strictEqual(drawButton.getAttribute("aria-disabled"), "true");

Game.cancelAIMove();
assert.strictEqual(Game.isLocked(), false, "animation cleanup must release the lock");
assert.strictEqual(drawButton.disabled, false, "button must return to validity state after animation lock");
assert.strictEqual(drawButton.getAttribute("aria-disabled"), "false");

Game.state.active = 2;
Game.state.opponent = "Baxi";
Game.maybeAIMove();
assert.strictEqual(Game.isLocked(), true, "AI thinking must set the game lock");
assert.strictEqual(drawButton.disabled, true, "button must be disabled during AI thinking");
assert.strictEqual(drawButton.getAttribute("aria-disabled"), "true");
// Issue #4: „…denkt…" steht jetzt in der Sprechblase der KI-Karte
// statt in der alten Statuszeile (#active-player ist entfernt).
assert.strictEqual(Game.state.bubble && Game.state.bubble[2], "…denkt…");

Game.cancelAIMove();
assert.strictEqual(Game.isLocked(), false, "AI cleanup must release the lock");
assert.strictEqual(drawButton.disabled, false, "button must return to validity state after AI lock");
assert.strictEqual(drawButton.getAttribute("aria-disabled"), "false");

// Restarting during AI thinking must clean up before start() resets the lock.
const originalNewHeaps = Game.newHeaps;
const originalRender = Game.render;
const originalMaybeAIMove = Game.maybeAIMove;
const originalAnimateAndRemove = Game.animateAndRemove;
Game.newHeaps = function () { return [3]; };
Game.render = function () {};
Game.maybeAIMove = originalMaybeAIMove;
Game.state.heaps = [3];
Game.state.selectedHeap = 0;
Game.state.active = 2;
Game.state.opponent = "Baxi";
Game.state.lock = false;
input.disabled = false;
input.value = "1";
Game.maybeAIMove();
const staleAiTimerIndex = timers.length - 1;
const staleAiCallback = timers[staleAiTimerIndex];
assert.strictEqual(Game.isLocked(), true, "the restart scenario must begin in AI thinking");
assert.strictEqual(input.disabled, true, "AI thinking must disable the input");

let staleAiCalls = 0;
Game.maybeAIMove = function () {};
Game.animateAndRemove = function () {
  staleAiCalls += 1;
};
nextRandomValue = 1; // make the restarted game active for the AI
Game.start();
assert.strictEqual(timers[staleAiTimerIndex], null, "start must cancel the old AI timer");
assert.strictEqual(Game.isLocked(), false, "start must release the old AI lock");
assert.strictEqual(input.disabled, false, "start must re-enable the input after AI cleanup");
staleAiCallback();
assert.strictEqual(staleAiCalls, 0, "a late AI callback must not affect the restarted game");
Game.animateAndRemove = originalAnimateAndRemove;

// The same cleanup must protect a restart during an animation timer.
Game.state.active = 1;
Game.state.opponent = "Mensch";
Game.state.lock = false;
input.disabled = false;
input.value = "1";
Game.animateAndRemove(0, 1, function () {});
const staleAnimationTimerId = Game._animTimer;
const staleAnimationCallback = timers[staleAnimationTimerId - 1];
assert.strictEqual(Game.isLocked(), true, "the animation scenario must begin locked");
Game.start();
assert.strictEqual(timers[staleAnimationTimerId - 1], null, "start must cancel the animation timer");
assert.strictEqual(Game.isLocked(), false, "start must release the animation lock");
assert.strictEqual(input.disabled, false, "start must re-enable the input after animation cleanup");
staleAnimationCallback();
assert.deepStrictEqual(Game.state.heaps, [3], "a late animation callback must not mutate the restarted heaps");

// newGame() and applyOptions() both route through the same restart cleanup.
Game.maybeAIMove = originalMaybeAIMove;
Game.state.active = 2;
Game.state.opponent = "Baxi";
Game.state.lock = false;
input.disabled = false;
Game.maybeAIMove();
const newGameTimerIndex = timers.length - 1;
Game.maybeAIMove = function () {};
Game.newGame();
assert.strictEqual(timers[newGameTimerIndex], null, "newGame must cancel an old AI timer");
assert.strictEqual(Game.isLocked(), false, "newGame must release an old AI lock");
assert.strictEqual(input.disabled, false, "newGame must re-enable the input");

Game.state.active = 1;
Game.state.opponent = "Mensch";
Game.state.lock = false;
input.disabled = false;
input.value = "1";
Game.animateAndRemove(0, 1, function () {});
const applyAnimationTimerId = Game._animTimer;
Game.validateOptions = function () { return true; };
Game.selectedRule = function () { return "4er"; };
Game.selectedOpponent = function () { return "Mensch"; };
Game.readOptionInt = function (id) {
  return id === "opt-max-heaps" ? 1 : (id === "opt-max-stones" ? 3 : 0);
};
Game.closeOptions = function () {};
Game.applyOptions();
assert.strictEqual(timers[applyAnimationTimerId - 1], null, "applyOptions must cancel an old animation timer");
assert.strictEqual(Game.isLocked(), false, "applyOptions must release an old animation lock");
assert.strictEqual(input.disabled, false, "applyOptions must re-enable the input");

Game.newHeaps = originalNewHeaps;
Game.render = originalRender;
Game.maybeAIMove = originalMaybeAIMove;

console.log("Bug 02 regression test passed");
