"use strict";

// Issue #3/#17: Die Mengen-Leiste ist entfernt — Zugabgabe läuft zwei-stufig
// AM HAUFEN (Issue #17): Tipp = Menge MARKIEREN, „Nimm!"-Button = ZUG.
// Die Regression deckt ab:
//   A) index.html und game.js enthalten keine entfernte Mengen-Leiste
//   B) Tipp auf die 3. Rosine (4er-Regel, Haufen ≥ 5) markiert genau 3;
//      „Nimm!" nimmt dann exakt 3
//   C) Eigene Liste {1,3,5}: illegale Menge markiert NICHTS
//   D) Klassisch: Menge > Haufengröße markiert NICHTS
//   E) Während Lock (Animation/KI) tut Tipp + Bestätigung nichts
//   F) selectHeap bleibt reine Auswahl (keine Menge, kein Zug)
//   G) Review: HaufenWECHSEL verwirft die laufende Mengenauswahl
//   H) Review: start() und undoMove() lassen keine Auswahl/Markierung stehen
//   I) Review: ein veraltetes pendingAmount entführt nie die „Nimm!\"-Menge
//   J) Review: Tastaturpfad (Ziffer markiert) + „Nimm!\"-Beschriftung (takeText)
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
  const takeBtn = element({});
  takeBtn.disabled = true;

  function generic() {
    return element();
  }

  // Issue #17 (Review): keydown-Handler des Haufen-Fragments greifbar
  // halten — bindEvents() hängt den Handler an heapsEl (nicht document),
  // damit Tastaturpfade hier ohne echtes DOM getestet werden können.
  const heapsWrap = element({
    addEventListener(name, handler) {
      if (name === "keydown") {
        heapsWrap._keydown = handler;
      }
    },
  });

  const document = {
    readyState: "loading",
    querySelector(selector) {
      if (selector === "#heaps") return heapsWrap;
      if (selector === '#heaps .heap[data-heap-index="0"]') return heapEl;
      if (selector === "#take-btn") return takeBtn;
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
  return { document, stones, heapEl, takeBtn, heapsWrap };
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
  // Issue #17 (Review): Tastatur-/Button-Highlevel-Pfade registrieren,
  // damit bindEvents() die realen Handler anlegt (keydown, „Nimm!“).
  if (typeof Game.bindEvents === "function") {
    Game.bindEvents();
  }
  return {
    Game,
    stones: dom.stones,
    heapEl: dom.heapEl,
    takeBtn: dom.takeBtn,
    heapsWrap: dom.heapsWrap,
    nim: NimImpl,
  };
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

// --- B) 4er-Regel: Tipp 3 MARKIERT genau 3; „Nimm!" nimmt dann exakt 3 ----
(function caseB() {
  const { Game, nim, takeBtn, stones } = run(ruleFour);
  reset(Game, [5], nim);
  Game.commitTap(0, 3);
  // Schritt 1: Markierung, noch KEIN Zug, Button frei.
  assert.deepStrictEqual(
    Game.state.heaps,
    [5],
    "a legal tap must only MARK the amount, not take stones",
  );
  assert.strictEqual(
    Game.state.lastMove,
    null,
    "marking must not record a move",
  );
  assert.strictEqual(
    Game.state.active,
    1,
    "marking must not change the player",
  );
  assert.strictEqual(
    Game.state.selectedAmount,
    3,
    "the tagged amount must be stored",
  );
  assert.ok(
    stones.slice(2).every((st) => st.classList.contains("selected")),
    "the LAST THREE stones must be marked",
  );
  assert.ok(
    stones.slice(0, 2).every((st) => !st.classList.contains("selected")),
    "the remaining stones must NOT be marked",
  );
  assert.strictEqual(
    takeBtn.disabled,
    false,
    "the 'Nimm!' button must be enabled on a legal mark",
  );
  // Schritt 2: „Nimm!" nimmt genau die markierte Menge.
  Game.takeNow();
  assert.deepStrictEqual(
    Game.state.heaps,
    [2],
    "'Nimm!' must remove exactly the marked 3 (4er rule)",
  );
  assert.strictEqual(
    Game.state.lastMove.amount,
    3,
    "lastMove must record the marked amount",
  );
  assert.strictEqual(
    Game.state.active,
    2,
    "turn must pass to the other player",
  );
  assert.strictEqual(
    Game.state.pendingAmount,
    null,
    "the amount must be consumed",
  );
  assert.strictEqual(
    Game.state.selectedAmount,
    null,
    "the mark must be cleared after the move",
  );
  assert.strictEqual(
    takeBtn.disabled,
    true,
    "the 'Nimm!' button must be disabled after the move",
  );
})();

// --- C) Eigene Liste {1,3,5}: Tipp 4 (illegal) → nichts markiert ----------
(function caseC() {
  const { Game, nim, takeBtn } = run(ruleOwn);
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
  assert.strictEqual(
    Game.state.selectedAmount,
    null,
    "an illegal tap must not mark an amount",
  );
  assert.strictEqual(
    takeBtn.disabled,
    true,
    "an illegal tap must not enable 'Nimm!'",
  );
})();

// --- D) Klassisch: Tipp jenseits der Haufengröße → nichts markiert --------
(function caseD() {
  const { Game, nim, takeBtn } = run(ruleClassic);
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
  assert.strictEqual(
    Game.state.selectedAmount,
    null,
    "an oversized tap must not mark an amount",
  );
  assert.strictEqual(
    takeBtn.disabled,
    true,
    "an oversized tap must not enable 'Nimm!'",
  );
})();

// --- E) Lock: Tipp + Bestätigung tun nichts -------------------------------
(function caseE() {
  const { Game, nim, takeBtn } = run(ruleFour);
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
  assert.strictEqual(
    Game.state.selectedAmount,
    null,
    "a locked tap must not mark an amount",
  );
  assert.strictEqual(
    takeBtn.disabled,
    true,
    "a locked tap must not enable 'Nimm!'",
  );
  // Und selbst nach dem Lock-Release darf die (fehlende) Auswahl nicht
  // spurlos bestätigt werden.
  Game.state.lock = false;
  Game.takeNow();
  assert.deepStrictEqual(
    Game.state.heaps,
    [5],
    "takeNow without a mark must be a no-op",
  );
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
  assert.strictEqual(
    Game.state.selectedAmount,
    null,
    "selectHeap must not tag an amount",
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

// --- G) HaufenWECHSEL verwirft die laufende Mengenauswahl (Issue #17) ----
(function caseG() {
  const { Game, nim, heapEl, takeBtn } = run(ruleFour);
  reset(Game, [5, 3], nim); // zwei Haufen → echte Auswahl eines anderen möglich
  // Haufen 0 markieren (3).
  Game.selectAmount(0, 3);
  assert.strictEqual(
    Game.state.selectedAmount,
    3,
    "Markierung auf Haufen 0 muss stehen",
  );
  assert.strictEqual(takeBtn.disabled, false, "Button muss aktiv sein");
  // Auf Haufen 1 wechseln: laufende Auswahl muss VERWORFEN werden.
  heapEl.dataset.heapIndex = "1";
  Game.selectHeap(1);
  assert.strictEqual(
    Game.state.selectedHeap,
    1,
    "selectHeap muss Haufen 1 auswählen",
  );
  assert.strictEqual(
    Game.state.selectedAmount,
    null,
    "ein Haufenwechsel darf die laufende Auswahl nicht mitnehmen",
  );
  assert.strictEqual(
    Game.state.pendingAmount,
    null,
    "ein Haufenwechsel darf keinen Mengenrest hinterlassen",
  );
  assert.strictEqual(
    takeBtn.disabled,
    true,
    "nach Haufenwechsel muss „Nimm!“ wieder gesperrt sein",
  );
})();

// --- I) veraltetes pendingAmount entführt nie die „Nimm!“-Menge ------------
(function caseI() {
  const { Game, nim, takeBtn } = run(ruleFour);
  reset(Game, [5], nim);
  // Simulierter KI-Direktpfad: Menge steht in pendingAmount (Issue #3/14);
  // die UI-Selection (selectedHeap) wurde dazwischen woanders hingerendert.
  Game.state.pendingAmount = 3;
  Game.state.selectedAmount = 2; // Mensch hat 2 markiert
  Game.state.selectedHeap = 0;
  // Mensch bestätigt die MARKIERUNG (2), nicht den KI-Rest (3):
  Game.takeNow();
  assert.deepStrictEqual(
    Game.state.heaps,
    [3],
    "takeNow muss die markierte Menge (2) ziehen, nicht den pending-3 → 5-2",
  );
  assert.strictEqual(
    Game.state.pendingAmount,
    null,
    "takeNow muss pendingAmount verbrauchen",
  );
  assert.strictEqual(Game.state.lastMove.amount, 2, "Zug muss Menge 2 sein");
  // Zusätzlich: executeMove() selbst darf im Guard-Fehlerfall keinen
  // pendingAmount-Rückstand hinterlassen (Review-F1).
  reset(Game, [5], nim);
  Game.state.pendingAmount = 9; // unmögliche Menge → Legalitäts-Guard schlägt
  Game.state.selectedHeap = 0;
  Game.executeMove();
  assert.deepStrictEqual(
    Game.state.heaps,
    [5],
    "ein illegales pendingAmount darf keinen Zug ausführen",
  );
  assert.strictEqual(
    Game.state.pendingAmount,
    null,
    "executeMove darf pendingAmount auch im Fehlerfall nicht stehen lassen",
  );
})();

// --- J) Tastaturpfad: Ziffer markiert, Enter bestätigt (Issue #17) --------
(function caseJ() {
  const { Game, nim, takeBtn, heapEl, heapsWrap, stones } = run(ruleFour);
  reset(Game, [5], nim);
  assert.ok(
    typeof heapsWrap._keydown === "function",
    "bindEvents muss den keydown-Handler am Haufen anlegen",
  );
  const fireKey = function (key) {
    const target = heapEl;
    const ev = {
      key: key,
      preventDefault() {},
      target: target,
      stopPropagation() {},
    };
    heapsWrap._keydown(ev);
  };
  // Ziffer „3“ am Haufen markiert (Step 1).
  fireKey("3");
  assert.strictEqual(
    Game.state.selectedAmount,
    3,
    "Ziffer 3 muss die Menge markieren",
  );
  (assert.strictEqual(
    takeBtn.disabled,
    false,
    "Ziffer-Eingabe muss „Nimm!“ freischalten",
  ),
    assert.ok(
      stones.slice(2).every((st) => st.classList.contains("selected")),
      "Tastatur-Markierung betrifft die letzten 3 Steine",
    ));
  // Enter auf dem selben Haufen bestätigt (Step 2).
  fireKey("Enter");
  assert.deepStrictEqual(
    Game.state.heaps,
    [2],
    "Enter muss die markierte Menge (3) ziehen",
  );
  assert.strictEqual(
    Game.state.selectedAmount,
    null,
    "Enter muss die Markierung verbrauchen",
  );
  assert.strictEqual(
    takeBtn.disabled,
    true,
    "nach dem Zug ist „Nimm!“ gesperrt",
  );
  // Esc bricht ab, wenn erneut markiert ist.
  fireKey("2");
  assert.strictEqual(Game.state.selectedAmount, 2, "Markierung 2 steht");
  fireKey("Escape");
  assert.strictEqual(
    Game.state.selectedAmount,
    null,
    "Escape muss die laufende Auswahl abbrechen",
  );
  assert.strictEqual(takeBtn.disabled, true, "Escape sperrt „Nimm!“ wieder");
})();

console.log(
  "Bug 03 regression test passed (tap/drag am Haufen statt Leiste + Issue-17-Review)",
);
