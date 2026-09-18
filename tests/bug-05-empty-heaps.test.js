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
    contains(name) { return classes.has(name); },
    setFromClassName(value) {
      classes.clear();
      value.split(/\s+/).filter(Boolean).forEach((name) => classes.add(name));
    }
  };
}

function makeElement() {
  const attributes = {};
  const listeners = {};
  const classList = makeClassList();
  const element = {
    disabled: false,
    hidden: true,
    textContent: "",
    value: "1",
    tabIndex: 0,
    dataset: {},
    children: [],
    classList,
    setAttribute(name, value) { attributes[name] = String(value); },
    getAttribute(name) {
      return attributes[name] === undefined ? null : attributes[name];
    },
    removeAttribute(name) {
      delete attributes[name];
    },
    addEventListener(name, handler) { listeners[name] = handler; },
    dispatch(name, event) {
      if (listeners[name]) {
        listeners[name](event);
      }
    },
    appendChild(child) { this.children.push(child); },
    querySelectorAll(selector) {
      if (selector === ".stone") {
        return this.children.filter((child) => child.classList.contains("stone"));
      }
      return [];
    },
    closest(selector) {
      return selector === ".heap" && this.classList.contains("heap") ? this : null;
    },
    focus() {}
  };
  Object.defineProperty(element, "className", {
    get() { return Array.from(classList.classes || []).join(" "); },
    set(value) { classList.setFromClassName(String(value)); }
  });
  return element;
}

const drawButton = makeElement();
const input = makeElement();
const error = makeElement();
const activePlayer = makeElement();
const lastMove = makeElement();
const heapsContainer = makeElement();
const elements = {
  "#heaps": heapsContainer,
  "#draw-btn": drawButton,
  "#amount-input": input,
  "#input-error": error,
  "#active-player": activePlayer,
  "#last-move": lastMove
};
Object.defineProperty(heapsContainer, "textContent", {
  get() { return ""; },
  set() { this.children.length = 0; }
});

const document = {
  readyState: "loading",
  querySelector(selector) { return elements[selector] || null; },
  querySelectorAll(selector) {
    return selector === "#heaps .heap"
      ? heapsContainer.children.filter((el) => el.classList.contains("heap"))
      : [];
  },
  createElement() { return makeElement(); },
  addEventListener() {}
};
const randomValues = [2, 0, 3, 2, 0];
const window = {
  Game: {},
  crypto: {
    getRandomValues(buffer) {
      buffer[0] = randomValues.shift();
      return buffer;
    }
  },
  Nim: {
    parseAllowed() { return null; },
    legalAmount(rule, allowed, amount, heapSize) {
      return amount >= 1 && amount <= heapSize;
    }
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
  setTimeout,
  clearTimeout
};

vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8"),
  context,
  { filename: "game.js" }
);

const Game = window.Game;
Game.state.maxHaufen = 3;
Game.state.minSteine = 0;
Game.state.maxSteine = 3;
Game.state.opponent = "Mensch";
Game.start();
assert.deepStrictEqual(Game.state.heaps, [0, 3, 2], "the empty-heap state must be reproducible");
assert.strictEqual(Game.state.selectedHeap, 1, "start must select the first non-empty heap");

// Also cover render() recovering from a stale empty-heap selection.
Game.state.selectedHeap = 0;
input.value = "1";
Game.render();

const renderedHeaps = heapsContainer.children;
const emptyHeap = renderedHeaps[0];
const legalHeap = renderedHeaps[1];
const otherLegalHeap = renderedHeaps[2];
assert.strictEqual(Game.state.selectedHeap, 1, "render must not leave an empty heap selected");
assert.strictEqual(emptyHeap.tabIndex, -1, "an empty heap must not be focusable");
assert.strictEqual(emptyHeap.getAttribute("role"), "none", "an empty heap must not expose an interactive role");
assert.strictEqual(emptyHeap.getAttribute("aria-pressed"), null, "an empty role=none heap must not expose aria-pressed");
assert.strictEqual(legalHeap.tabIndex, 0, "a non-empty heap must remain focusable");
assert.strictEqual(legalHeap.getAttribute("role"), "button");

heapsContainer.dispatch("click", { target: emptyHeap });
assert.strictEqual(Game.state.selectedHeap, 1, "clicking an empty heap must be ignored");
heapsContainer.dispatch("keydown", {
  key: "Enter",
  target: emptyHeap,
  preventDefault() {}
});
heapsContainer.dispatch("keydown", {
  key: " ",
  target: emptyHeap,
  preventDefault() {}
});
assert.strictEqual(Game.state.selectedHeap, 1, "keyboard activation of an empty heap must be ignored");
assert.strictEqual(drawButton.disabled, false, "the remaining selected legal heap must keep the button enabled");
assert.strictEqual(error.hidden, true, "an ignored empty-heap activation must not show an input error");
assert.strictEqual(legalHeap.getAttribute("aria-pressed"), "true");
assert.strictEqual(emptyHeap.getAttribute("aria-pressed"), null, "an empty role=none heap must remain without aria-pressed");

heapsContainer.dispatch("click", { target: otherLegalHeap });
assert.strictEqual(Game.state.selectedHeap, 2, "another non-empty heap must remain selectable immediately");
assert.strictEqual(drawButton.disabled, false, "a legal amount must enable the button on another heap");
assert.strictEqual(otherLegalHeap.getAttribute("aria-pressed"), "true");
assert.strictEqual(legalHeap.getAttribute("aria-pressed"), "false");

// minSteine=0 may generate empty heaps, but never an entirely empty start.
randomValues.length = 0;
randomValues.push(0, 0);
Game.state.maxHaufen = 3;
Game.state.minSteine = 0;
Game.state.maxSteine = 3;
Game.start();
assert.deepStrictEqual(Game.state.heaps, [1], "an entirely empty generation must be replaced by a playable heap");
assert.ok(Game.state.heaps.some((size) => size >= 1), "a minSteine=0 start must contain a stone");
assert.ok(Game.state.heaps.every((size) => size >= 0 && size <= 3), "the fallback must stay within the configured bounds");
assert.strictEqual(Game.state.selectedHeap, 0, "the fallback heap must be selected");

console.log("Bug 05 regression test passed");
