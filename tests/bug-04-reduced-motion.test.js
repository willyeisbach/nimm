"use strict";

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
      const enabled = force === undefined ? !classes.has(name) : force;
      if (enabled) {
        classes.add(name);
      } else {
        classes.delete(name);
      }
      return enabled;
    },
    contains(name) {
      return classes.has(name);
    },
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
    setAttribute(name, value) {
      attributes[name] = String(value);
    },
    getAttribute(name) {
      return attributes[name] === undefined ? null : attributes[name];
    },
    addEventListener(name, handler) {
      listeners[name] = handler;
    },
    dispatch(name) {
      if (listeners[name]) {
        listeners[name]();
      }
    },
    appendChild() {},
    querySelectorAll() {
      return [];
    },
    remove() {
      this.removed = true;
    },
    focus() {},
  };
  return element;
}

const heapsContainer = makeElement();
const heap = makeElement();
heap.dataset.heapIndex = "0";
const stones = [makeElement(), makeElement(), makeElement()];
heap.querySelectorAll = function (selector) {
  const liveStones = stones.filter((stone) => !stone.removed);
  if (selector === ".stone") {
    return liveStones;
  }
  if (selector === ".stone.blinking") {
    return liveStones.filter((stone) => stone.classList.contains("blinking"));
  }
  return [];
};

const timers = [];
let reducedMotion = true;
const document = {
  readyState: "loading",
  querySelector(selector) {
    const elements = {
      "#heaps": heapsContainer,
      '#heaps .heap[data-heap-index="0"]': heap,
    };
    return elements[selector] || null;
  },
  querySelectorAll(selector) {
    return selector === "#heaps .heap" ? [heap] : [];
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
  Nim: {
    parseAllowed() {
      return null;
    },
    legalAmount(rule, allowed, amount, heapSize) {
      return amount >= 1 && amount <= heapSize;
    },
  },
  matchMedia() {
    return { matches: reducedMotion };
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
  setTimeout(fn, delay) {
    const timer = { fn, delay, cancelled: false };
    timers.push(timer);
    return timer;
  },
  clearTimeout(timer) {
    if (timer) {
      timer.cancelled = true;
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
Game.state.heaps = [3];
Game.state.selectedHeap = 0;
Game.state.lock = false;

let callbackCalls = 0;
Game.animateAndRemove(0, 2, function () {
  callbackCalls += 1;
});
assert.strictEqual(
  Game.state.heaps[0],
  1,
  "reduced motion must remove stones immediately",
);
assert.strictEqual(
  callbackCalls,
  1,
  "reduced motion must invoke the callback once",
);
assert.strictEqual(
  Game.isLocked(),
  false,
  "reduced motion must release the lock",
);
assert.strictEqual(
  Game._animTimer,
  undefined,
  "reduced motion must not leave an animation timer",
);
assert.strictEqual(
  timers.length,
  0,
  "reduced motion must not wait on the safety timer",
);
assert.strictEqual(stones.filter((stone) => stone.removed).length, 2);
assert.strictEqual(
  stones.filter(
    (stone) => !stone.removed && stone.classList.contains("blinking"),
  ).length,
  0,
  "reduced motion cleanup must leave no live blinking stones",
);

stones.forEach((stone) => {
  stone.removed = false;
  stone.classList.remove("blinking");
});
Game.state.heaps = [3];
Game.state.lock = false;
reducedMotion = false;
callbackCalls = 0;

Game.animateAndRemove(0, 2, function () {
  callbackCalls += 1;
});
assert.strictEqual(
  Game.isLocked(),
  true,
  "normal motion must lock during animation",
);
assert.strictEqual(
  timers.length,
  1,
  "normal motion must install one safety timer",
);
const normalTimer = timers[0];
stones[1].dispatch("animationend");
assert.strictEqual(
  Game.state.heaps[0],
  1,
  "animationend must remove exactly the requested amount",
);
assert.strictEqual(
  callbackCalls,
  1,
  "animationend must invoke the callback once",
);
assert.strictEqual(
  Game.isLocked(),
  false,
  "animationend must release the lock",
);
assert.strictEqual(
  Game._animTimer,
  undefined,
  "animationend must clean up the safety timer",
);
assert.strictEqual(
  normalTimer.cancelled,
  true,
  "animationend must cancel the safety timer",
);

// A late duplicate trigger must be harmless and must not subtract again.
normalTimer.fn();
assert.strictEqual(
  Game.state.heaps[0],
  1,
  "duplicate completion must not subtract twice",
);
assert.strictEqual(
  callbackCalls,
  1,
  "duplicate completion must not invoke the callback twice",
);
assert.strictEqual(
  Game._animTimer,
  undefined,
  "duplicate completion must keep timer cleanup intact",
);

console.log("Bug 04 regression test passed");
