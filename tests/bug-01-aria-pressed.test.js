"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function makeElement(heapIndex) {
  const classes = new Set();
  const attributes = {};
  return {
    dataset: heapIndex === undefined ? {} : { heapIndex: String(heapIndex) },
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
    getAttribute(name) { return attributes[name] === undefined ? null : attributes[name]; },
    addEventListener() {},
    appendChild() {},
    querySelectorAll() { return []; },
    value: "1"
  };
}

const heaps = [makeElement(0), makeElement(1)];
const genericElement = makeElement();
const document = {
  readyState: "loading",
  querySelector(selector) {
    return selector === "#heaps" ? genericElement : genericElement;
  },
  querySelectorAll(selector) {
    return selector === "#heaps .heap" ? heaps : [];
  },
  createElement() { return makeElement(); },
  addEventListener() {}
};
const window = {
  Game: {},
  Nim: {
    parseAllowed() { return null; },
    legalAmount() { return true; }
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

window.Game.state.heaps = [5, 7];
window.Game.state.selectedHeap = 0;
window.Game.selectHeap(0);
assert.deepStrictEqual(
  heaps.map((heap) => heap.getAttribute("aria-pressed")),
  ["true", "false"],
  "initial selection must be reflected in aria-pressed"
);

window.Game.selectHeap(1);
assert.deepStrictEqual(
  heaps.map((heap) => heap.getAttribute("aria-pressed")),
  ["false", "true"],
  "changing selection must move aria-pressed to the new heap"
);
assert.deepStrictEqual(
  heaps.map((heap) => heap.classList.contains("selected")),
  [false, true],
  "the visual selection must match aria-pressed"
);

console.log("Bug 01 regression test passed");
