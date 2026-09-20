"use strict";

// Issue #8: Unerlaubte Menge wird AM HAUFEN rückgemeldet (Schütteln +
// Blase in Kindersprache), nicht im (seit Issue #3 entfernten) Formular.
// Drei Fälle aus den Akzeptanzkriterien + Danach-Muss-immer-gehen-Garantie.
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
  const listeners = {};
  const el = {
    disabled: false,
    hidden: false,
    textContent: "",
    value: "",
    dataset: {},
    tabIndex: 0,
    offsetWidth: 0,
    classList: makeClassList(),
    _children: [],
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
    dispatch(name, event) {
      if (listeners[name]) {
        listeners[name](event || {});
      }
    },
    appendChild(child) {
      el._children.push(child);
    },
    removeChild(child) {
      const i = el._children.indexOf(child);
      if (i !== -1) el._children.splice(i, 1);
    },
    remove() {
      this.removed = true;
    },
    focus() {},
  };
  return Object.assign(el, extra || {});
}

function buildDom(stoneCount) {
  const stones = [];
  for (let i = 0; i < stoneCount; i++) {
    const s = element();
    s.classList.add("stone");
    stones.push(s);
  }
  const heapEl = element({ _children: stones.slice() });
  heapEl.classList.add("heap");
  heapEl.dataset.heapIndex = "0";
  heapEl.querySelectorAll = function (selector) {
    if (selector === ".stone")
      return heapEl._children.filter((c) => !c.removed);
    return [];
  };
  heapEl.querySelector = function (selector) {
    if (selector === ".heap-feedback") {
      return (
        heapEl._children.find((c) => c.className === "heap-feedback") || null
      );
    }
    return null;
  };
  const generic = element();
  const document = {
    readyState: "loading",
    querySelector(selector) {
      if (selector === '#heaps .heap[data-heap-index="0"]') return heapEl;
      if (selector === "#heaps") {
        return element({
          querySelectorAll: function (sel) {
            if (sel === ".stone") return stones;
            return [];
          },
        });
      }
      if (
        selector === "#undo-btn" ||
        selector === "#new-round-btn" ||
        selector === "#active-player" ||
        selector === "#last-move" ||
        selector === "#characters"
      )
        return generic;
      return null; // Die entfernten Formular-Elemente werden nicht gemockt.
    },
    querySelectorAll(selector) {
      return selector === "#heaps .heap" ? [heapEl] : [];
    },
    createElement() {
      return element();
    },
    addEventListener() {},
    contains() {
      return true;
    },
  };
  return { document, stones, heapEl };
}

function run(NimImpl) {
  const dom = buildDom(8);
  const window = {
    Game: {},
    Nim: NimImpl,
    AI: {
      chooseMove() {
        assert.fail("KI must not fire here");
      },
    },
  };
  const firedTimers = [];
  const context = {
    window,
    document: dom.document,
    console,
    Math,
    Number,
    Array,
    Uint32Array,
    parseInt,
    setTimeout(fn) {
      firedTimers.push(fn);
      return {};
    },
    clearTimeout() {},
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8"),
    context,
    { filename: "game.js" },
  );
  const Game = window.Game;
  Game.render = function () {};
  Game.animateAndRemove = function (heapIdx, amount, cb) {
    Game.state.heaps[heapIdx] -= amount;
    Game.state.lock = false;
    cb();
  };
  return { Game, nim: NimImpl, heapEl: dom.heapEl, timers: firedTimers };
}

function reset(Game, heaps, nim) {
  Game.state.heaps = heaps.slice();
  Game.state.selectedHeap = 0;
  Game.state.active = 1;
  Game.state.opponent = "Mensch";
  Game.state.lock = false;
  Game.state.pendingAmount = null;
  Game.state.undoStack = [];
  Game.state.lastMove = null;
  Game.state.allowed = nim.parseAllowed();
  Game.checkWin = function () {};
  Game.maybeAIMove = function () {};
}

const ruleFour = {
  parseAllowed() {
    return [1, 2, 3, 4];
  },
  legalAmount(rule, allowed, amount, heapSize) {
    return allowed.indexOf(amount) !== -1 && amount <= heapSize;
  },
};
const ruleOwn = {
  parseAllowed() {
    return [1, 3, 5];
  },
  legalAmount(rule, allowed, amount, heapSize) {
    return allowed.indexOf(amount) !== -1 && amount <= heapSize;
  },
};
const ruleClassic = {
  parseAllowed() {
    return null;
  },
  legalAmount(rule, allowed, amount, heapSize) {
    return amount >= 1 && amount <= heapSize;
  },
};

function feedbackText(heapEl) {
  const note = heapEl._children.find((c) => c.className === "heap-feedback");
  return note ? note.textContent : null;
}

// --- AK1: 4er-Nimm, Haufen 7, Tipp 5 → kein Stein weg, „Nur … bis 4"-Hinweis
(function case1() {
  const { Game, nim, heapEl } = run(ruleFour);
  reset(Game, [7], nim);
  Game.commitTap(0, 5);
  assert.deepStrictEqual(
    Game.state.heaps,
    [7],
    "5 > 4 (4er-Regel) must NOT move",
  );
  assert.strictEqual(Game.state.lastMove, null, "no move must be recorded");
  assert.strictEqual(Game.state.active, 1, "player turn must not change");
  assert.ok(heapEl.classList.contains("heap--shake"), "the heap must shake");
  const text = feedbackText(heapEl);
  assert.ok(text, "a heap feedback note must appear");
  assert.ok(
    /4/.test(text) && /nur/i.test(text),
    "the feedback must name the allowed upper bound, got: " + text,
  );

  // AK4: danach ist der nächste legale Zug sofort möglich (kein klemmender Lock).
  assert.strictEqual(
    Game.state.lock,
    false,
    "no lock may remain after the feedback",
  );
  Game.commitTap(0, 3);
  assert.deepStrictEqual(
    Game.state.heaps,
    [4],
    "the next legal tap must move immediately",
  );
  assert.strictEqual(
    Game.state.lastMove.amount,
    3,
    "the legal move must commit",
  );
})();

// --- AK2: Eigene Liste {1,3,5}, Haufen 7, Tipp 2 → Hinweis mit erlaubten Zahlen
(function case2() {
  const { Game, nim, heapEl } = run(ruleOwn);
  reset(Game, [7], nim);
  Game.commitTap(0, 2);
  assert.deepStrictEqual(Game.state.heaps, [7], "2 ∉ {1,3,5} must NOT move");
  assert.strictEqual(Game.state.lastMove, null, "no move must be recorded");
  assert.strictEqual(
    Game.state.undoStack.length,
    0,
    "no undo snapshot must be pushed",
  );
  const text = feedbackText(heapEl);
  assert.ok(text, "a heap feedback note must appear");
  assert.ok(
    /1/.test(text) && /3/.test(text) && /5/.test(text),
    "the feedback must list the allowed numbers 1, 3, 5, got: " + text,
  );
  Game.commitTap(0, 5);
  assert.deepStrictEqual(
    Game.state.heaps,
    [2],
    "a listed amount (5) must move",
  );
})();

// --- AK3: Klassisch, Menge > Haufengröße → „So viele sind nicht da!"
(function case3() {
  const { Game, nim, heapEl } = run(ruleClassic);
  reset(Game, [3], nim);
  Game.commitTap(0, 9);
  assert.deepStrictEqual(
    Game.state.heaps,
    [3],
    "an oversized amount must NOT move",
  );
  assert.strictEqual(Game.state.lastMove, null, "no move must be recorded");
  const text = feedbackText(heapEl);
  assert.ok(text, "a heap feedback note must appear");
  assert.ok(
    /nicht da/i.test(text),
    "the feedback must say the amount is not there, got: " + text,
  );
  Game.commitTap(0, 2);
  assert.deepStrictEqual(
    Game.state.heaps,
    [1],
    "a legal amount must still move",
  );
})();

console.log("Issue 08 regression test passed (heap feedback instead of form)");
