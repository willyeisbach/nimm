"use strict";

// Issue #3: Die Mengen-Leiste ist entfernt — Zugabgabe läuft nur noch am
// Haufen (Tipp = Zug, Ziehen-Loslassen = Zug). Die Regression deckt ab:
//   A) index.html und game.js enthalten keine entfernte Mengen-Leiste
//   B) Tipp auf die 3. Rosine (4er-Regel, Haufen ≥ 5) nimmt genau 3
//   C) Eigene Liste {1,3,5}: illegale Menge bleibt liegen und meldet sich am Haufen
//   D) Klassisch: Menge > Haufengröße bleibt liegen und meldet sich am Haufen
//   E) Während Lock (Animation/KI) tut Tipp nichts
//   F) selectHeap bleibt reine Auswahl (keine Menge, kein Zug)
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// --- A) Leiste ist aus dem Markup weg --------------------------------------
const indexHtml = fs.readFileSync(
  path.join(__dirname, "..", "index.html"),
  "utf8",
);
[
  "move-input",
  "amount-input",
  "draw-btn",
  "minus-btn",
  "plus-btn",
  "amount-preview",
  "input-error",
  "nimm-btn",
].forEach(function (id) {
  assert.ok(
    indexHtml.indexOf(id) === -1,
    "index.html must not contain the removed Leiste markup: " + id,
  );
});
const gameSource = fs.readFileSync(
  path.join(__dirname, "..", "game.js"),
  "utf8",
);
[
  "#amount-input",
  "#draw-btn",
  "#input-error",
  "#minus-btn",
  "#plus-btn",
  "#amount-preview",
  "Game.readAmount",
  "Game.updateButtonState",
  "Game.previewAmount",
  "Game.bumpAmount",
].forEach(function (legacyPath) {
  assert.strictEqual(
    gameSource.indexOf(legacyPath),
    -1,
    "game.js must not retain the removed form path: " + legacyPath,
  );
});
const styleSource = fs.readFileSync(
  path.join(__dirname, "..", "style.css"),
  "utf8",
);
[".stone.marked", ".stone.popping"].forEach(function (legacyStyle) {
  assert.strictEqual(
    styleSource.indexOf(legacyStyle),
    -1,
    "style.css must not retain the removed selection style: " + legacyStyle,
  );
});
assert.ok(
  indexHtml.indexOf("Noch mal!") !== -1,
  "the toolbar (Noch mal!) must stay",
);
assert.ok(
  indexHtml.indexOf("undo-btn") !== -1,
  "the toolbar (Rückgängig) must stay",
);

// --- DOM-Mock (nur die aktuelle Haufen-Interaktion) --------------------------
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
    style: {},
    classList: makeClassList(),
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
      (el.children = el.children || []).push(child);
    },
    querySelectorAll() {
      return el.children || [];
    },
    closest(selector) {
      if (selector === ".stone" && el.classList.contains("stone")) return el;
      if (selector === ".heap" && el.classList.contains("heap")) return el;
      return null;
    },
    remove() {
      this.removed = true;
    },
    focus() {},
  };
  return Object.assign(el, extra || {});
}

function makeStones(count) {
  const stones = [];
  for (let i = 0; i < count; i++) {
    const s = element();
    s.classList.add("stone");
    stones.push(s);
  }
  return stones;
}

function buildDom() {
  const stones = makeStones(5);
  const heapEl = element({ children: stones });
  heapEl.classList.add("heap");
  heapEl.dataset.heapIndex = "0";
  heapEl.querySelectorAll = function (selector) {
    if (selector === ".stone") return stones.filter((st) => !st.removed);
    if (selector === ".stone.blinking") {
      return stones.filter(
        (st) => !st.removed && st.classList.contains("blinking"),
      );
    }
    return [];
  };

  function generic() {
    return element();
  }

  const document = {
    readyState: "loading",
    querySelector(selector) {
      if (selector === "#heaps") {
        return element({
          querySelectorAll: function (sel) {
            if (sel === ".stone") return stones;
            if (sel === "#heaps .heap") return [heapEl];
            return [];
          },
        });
      }
      if (selector === '#heaps .heap[data-heap-index="0"]') return heapEl;
      if (selector === "#undo-btn") return generic();
      if (selector === "#new-round-btn") return generic();
      if (selector === "#characters") return generic();
      return null;
    },
    querySelectorAll(selector) {
      return selector === "#heaps .heap" ? [heapEl] : [];
    },
    createElement() {
      return generic();
    },
    addEventListener() {},
    contains() {
      return true;
    },
  };
  return { document, stones, heapEl };
}

function run(NimImpl) {
  const dom = buildDom();
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
    document: dom.document,
    console,
    Math,
    Number,
    Array,
    Uint32Array,
    parseInt,
    setTimeout(fn) {
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
  // Die Tap-/Drag-Tests prüfen Commit-Semantik, nicht das Rendering.
  // Ein echtes render() im Mock-DOM würde zu viele Unbekannte mitziehen.
  Game.render = function () {};
  // Animation sofort erledigen (Kein echtes Timing in der Unit-Test-Welt).
  Game.animateAndRemove = function (heapIdx, amount, cb) {
    Game.state.heaps[heapIdx] -= amount;
    Game.state.lock = false;
    cb();
  };
  return { Game, stones: dom.stones, nim: NimImpl };
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
  Game.state.rule = nim.rule || "4er";
  Game.checkWin = function () {};
  Game.maybeAIMove = function () {};
}

const ruleFour = {
  rule: "4er",
  parseAllowed() {
    return [1, 2, 3, 4];
  },
  legalAmount(rule, allowed, amount, heapSize) {
    return allowed.indexOf(amount) !== -1 && amount <= heapSize;
  },
};
const ruleOwn = {
  rule: "own",
  parseAllowed() {
    return [1, 3, 5];
  },
  legalAmount(rule, allowed, amount, heapSize) {
    return allowed.indexOf(amount) !== -1 && amount <= heapSize;
  },
};
const ruleClassic = {
  rule: "classic",
  parseAllowed() {
    return null;
  },
  legalAmount(rule, allowed, amount, heapSize) {
    return amount >= 1 && amount <= heapSize;
  },
};

// --- B) 4er-Regel: Tipp 3 nimmt exakt 3 ------------------------------------
(function caseB() {
  const { Game, nim } = run(ruleFour);
  reset(Game, [5], nim);
  Game.commitTap(0, 3);
  assert.deepStrictEqual(
    Game.state.heaps,
    [2],
    "tap 3 must remove exactly 3 (4er rule)",
  );
  assert.strictEqual(
    Game.state.lastMove.amount,
    3,
    "lastMove must record the tapped amount",
  );
  assert.strictEqual(
    Game.state.active,
    2,
    "turn must pass to the other player",
  );
  assert.strictEqual(
    Game.state.pendingAmount,
    null,
    "the pending amount must be consumed",
  );
})();

// --- C) Eigene Liste {1,3,5}: Tipp 4 (illegal) → kein Zug + Feedback am Haufen
(function caseC() {
  const { Game, nim } = run(ruleOwn);
  reset(Game, [6], nim);
  Game.commitTap(0, 4);
  assert.deepStrictEqual(
    Game.state.heaps,
    [6],
    "an illegal amount (4 ∉ {1,3,5}) must NOT move",
  );
  assert.strictEqual(
    Game.state.lastMove,
    null,
    "an illegal tap must not record a move",
  );
  assert.strictEqual(
    Game.state.active,
    1,
    "an illegal tap must keep the same player",
  );
  assert.strictEqual(
    Game.state.undoStack.length,
    0,
    "an illegal tap must not push an undo snapshot",
  );
})();

// --- D) Klassisch: Tipp jenseits der Haufengröße → kein Zug + Feedback ------
(function caseD() {
  const { Game, nim } = run(ruleClassic);
  reset(Game, [3], nim);
  Game.commitTap(0, 9);
  assert.deepStrictEqual(
    Game.state.heaps,
    [3],
    "a tap beyond the heap size must not move",
  );
  assert.strictEqual(
    Game.state.lastMove,
    null,
    "no move must be recorded for an oversized tap",
  );
})();

// --- E) Lock: Tipp tut nichts ----------------------------------------------
(function caseE() {
  const { Game, nim } = run(ruleFour);
  reset(Game, [5], nim);
  Game.state.lock = true;
  Game.commitTap(0, 3);
  assert.deepStrictEqual(
    Game.state.heaps,
    [5],
    "a tap while locked must not move stones",
  );
  assert.strictEqual(
    Game.state.pendingAmount,
    null,
    "a locked tap must not leave a pending amount",
  );
  Game.state.lock = false;
})();

// --- F) selectHeap bleibt reine Auswahl ------------------------------------
(function caseF() {
  const { Game, nim } = run(ruleFour);
  reset(Game, [5], nim);
  Game.selectHeap(0);
  assert.strictEqual(
    Game.state.selectedHeap,
    0,
    "selectHeap must select the heap",
  );
  assert.strictEqual(
    Game.state.pendingAmount,
    null,
    "selectHeap must not set a move amount",
  );
  assert.deepStrictEqual(
    Game.state.heaps,
    [5],
    "selectHeap must not remove stones",
  );
  assert.strictEqual(
    Game.state.active,
    1,
    "selectHeap must not switch players",
  );
})();

console.log("Bug 03 regression test passed (tap/drag am Haufen statt Leiste)");
