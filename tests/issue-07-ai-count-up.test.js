"use strict";

// Issue #7: KI zählt genommene Rosinen in der Sprechblase mit.
// - AK1: KI nimmt 1 → Blase nennt einmal die 1, dann Zug fertig.
// - AK2: KI nimmt 4 → vier erkennbare Zählschritte, bevor die Steine weg sind.
// - AK3: Mensch-Zug → kein erzwungenes Mitzählen.
// - AK4: Lock bleibt währenddessen; kein Doppelzug.
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
    removed: false,
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
    fire(name) {
      if (listeners[name]) {
        listeners[name]({});
      }
    },
    appendChild(child) {
      el._children.push(child);
    },
    remove() {
      this.removed = true;
    },
  };
  return Object.assign(el, extra || {});
}

function buildDom(initialStones) {
  const stones = [];
  for (let i = 0; i < initialStones; i++) {
    const s = element();
    s.classList.add("stone");
    stones.push(s);
  }
  const heapEl = element({ _children: stones.slice() });
  heapEl.classList.add("heap");
  heapEl.querySelectorAll = function (sel) {
    if (sel === ".stone" || sel === ".stone.blinking") {
      return heapEl._children.filter(function (c) {
        return !c.removed;
      });
    }
    return [];
  };
  const document = {
    readyState: "loading",
    querySelector(selector) {
      if (selector === '#heaps .heap[data-heap-index="0"]') return heapEl;
      return null; // #char-* bewusst nicht geliefert: renderCharacters ist Null-safe
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
  return { document, stones, heapEl };
}

/** Steuerbarer Timeout-Warteschlange (determinischer Flush). */
function makeTimers() {
  let nextId = 1;
  const queue = [];
  function setTimeout(fn, delay) {
    const id = nextId++;
    queue.push({ id, fn, delay, cleared: false });
    return id;
  }
  function clearTimeout(id) {
    const item = queue.find(function (t) {
      return t.id === id;
    });
    if (item) {
      item.cleared = true;
    }
  }
  // Chain-Durchlauf: IMMER den nächsten einzelnen Zeitgeber (kleinstes
  // Delay) feuern — so schaltet sich die Zähl-Kette korrekt weiter und der
  // späte Cleanup-Timer (BLINK_TOTAL+200) läuft zuletzt, wie im Browser.
  function drain(upto) {
    let guard = 0;
    for (;;) {
      let min = null;
      for (const t of queue) {
        if (t.cleared || t.delay > upto) {
          continue;
        }
        if (min === null || t.delay < min.delay) {
          min = t;
        }
      }
      if (!min) {
        break;
      }
      min.cleared = true;
      min.fn();
      if (++guard > 100) {
        throw new Error("Timer-Durchlauf: zu viele Schritte");
      }
    }
  }
  return {
    setTimeout,
    clearTimeout,
    drain,
    pending: function () {
      return queue.filter(function (t) {
        return !t.cleared;
      }).length;
    },
  };
}

function loadGame(NimImpl, timers) {
  const dom = buildDom(6);
  const window = {
    Game: {},
    Nim: NimImpl,
    AI: {
      chooseMove() {
        assert.fail("KI muss hier nicht ziehen");
      },
    },
  };
  const context = {
    window,
    document: dom.document,
    console,
    Math,
    Array,
    Number,
    Uint32Array,
    parseInt,
    clearTimeout: timers.clearTimeout,
  };
  context.setTimeout = timers.setTimeout;
  context.window.matchMedia = function () {
    return { matches: false }; // keine Reduced-Motion-Abkürzung
  };
  window.matchMedia = context.window.matchMedia;
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8"),
    context,
    { filename: "game.js" },
  );
  return { Game: window.Game, heapEl: dom.heapEl, stones: dom.stones };
}

const nim = {
  parseAllowed() {
    return [1, 2, 3, 4];
  },
  legalAmount(rule, allowed, amount, heapSize) {
    return allowed.indexOf(amount) !== -1 && amount <= heapSize;
  },
  nimSum() {
    return 1;
  },
};

function run(moveCase) {
  const timers = makeTimers();
  const { Game, heapEl, stones } = loadGame(nim, timers);
  // Rendering/Selektions-Updates hier nicht geprüft — stubben (wie bug-03).
  Game.render = function () {};
  Game.renderSelection = Game.renderSelection || function () {};
  const s = Game.state;
  s.heaps = [6];
  s.active = moveCase.actor; // 1 = Mensch, 2 = KI
  s.opponent = moveCase.actor === 2 ? "Baxi" : "Mensch";
  s.name2 = s.opponent;
  s.selectedHeap = 0;
  s.lock = false;
  s.pendingAmount = null;
  s.undoStack = [];
  s.lastMove = null;
  s.bubble = {};
  s.allowed = nim.parseAllowed();
  s.checkWin = function () {};
  s.maybeAIMove = function () {};

  // ALLE Sprechblasen-Schritte der KI erfassen (production überschreibt
  // s.bubble[2] bei jedem Schritt — ein reiner Snapshot wäre zu knapp).
  const countSteps = [];
  const origSetBubble = Game.setBubble;
  Game.setBubble = function (player, text) {
    if (player === 2 && text) {
      if (countSteps[countSteps.length - 1] !== text) {
        countSteps.push(text);
      }
    }
    return origSetBubble(player, text);
  };
  Game.renderCharacters = function () {};

  // animateAndRemove mit demselben Callback wie executeMove:
  // lastMove setzen, aktiven Spieler wechseln, Lock auflösen.
  let cbRan = false;
  Game.animateAndRemove(0, moveCase.amount, function () {
    cbRan = true;
    s.lastMove = {
      player: moveCase.actor,
      heapIdx: 0,
      amount: moveCase.amount,
    };
    s.active = s.active === 1 ? 2 : 1;
  });

  assert.strictEqual(
    s.lock,
    true,
    "AK4: Lock ist während der Animation gesetzt",
  );
  const heapDuring = s.heaps.slice();

  // AK4: kein Doppelzug währenddessen (Lock blockt die Eingabe).
  Game.commitTap(0, 1);
  const doubleTapBlocked = s.heaps[0] === 6;
  const lockBlocked = s.lock === true;

  // Animation abschließen: animationend auf einem Ziel-Stein feuern
  // (Targets sind die ERSTEN `amount` Steine, linksbündig).
  // Danach alle ausstehenden Zeitgeber (Zähl-Kette, Backstop) durcharbeiten.
  const firstTarget = stones[0];
  if (firstTarget) {
    firstTarget.fire("animationend");
  }
  timers.drain(100000);

  return {
    heapDuring,
    heapAfter: s.heaps.slice(),
    lastMove: s.lastMove ? s.lastMove.amount : null,
    lockAfter: s.lock,
    activeAfter: s.active,
    lockBlocked,
    doubleTapBlocked,
    countSteps,
    cbRan,
  };
}

// --- AK1: KI nimmt 1 → genau ein Zählschritt ("… 1 …"), dann fertig --------
(function ak1() {
  const r = run({ actor: 2, amount: 1 });
  assert.strictEqual(
    r.heapDuring[0],
    6,
    "Steine bleiben erst WÄHREND der Animation",
  );
  assert.strictEqual(r.heapAfter[0], 5, "danach ist genau 1 weg");
  assert.strictEqual(r.lastMove, 1, "der Zug wird committed");
  assert.ok(
    r.countSteps.length === 1 &&
      /eins/i.test(r.countSteps[0]) &&
      /nimm/i.test(r.countSteps[0]),
    "KI nennt einmal die 1, Schritte: " + JSON.stringify(r.countSteps),
  );
  assert.strictEqual(
    r.lockBlocked,
    true,
    "AK4: Lock hält während der Animation",
  );
  assert.strictEqual(r.doubleTapBlocked, true, "AK4: kein Doppelzug");
  assert.strictEqual(r.lockAfter, false, "Lock löst sich nach dem Zug");
  assert.strictEqual(r.activeAfter, 1, "Zugwechsel nach dem KI-Zug");
})();

// --- AK2: KI nimmt 4 → vier erkennbare Zählschritte vor dem Stein-Verschwinden ---
(function ak2() {
  const r = run({ actor: 2, amount: 4 });
  assert.strictEqual(
    r.heapDuring[0],
    6,
    "Steine bleiben während der Animation",
  );
  assert.strictEqual(r.heapAfter[0], 2, "danach sind genau 4 weg");
  assert.strictEqual(r.lastMove, 4, "der Zug wird committed");
  assert.ok(
    r.countSteps.length === 4,
    "AK2: es sind VIER Zählschritte erkennbar, got: " +
      JSON.stringify(r.countSteps),
  );
  assert.ok(
    /eins/i.test(r.countSteps[0]),
    "Schritt 1 = Eins: " + r.countSteps[0],
  );
  assert.ok(
    /zwei/i.test(r.countSteps[1]),
    "Schritt 2 = Zwei: " + r.countSteps[1],
  );
  assert.ok(
    /drei/i.test(r.countSteps[2]),
    "Schritt 3 = Drei: " + r.countSteps[2],
  );
  assert.ok(
    /vier/i.test(r.countSteps[3]) && /nimm/i.test(r.countSteps[3]),
    "Schritt 4 = Vier — Nimm: " + r.countSteps[3],
  );
  assert.strictEqual(
    r.lockBlocked,
    true,
    "AK4: Lock hält während des Mitzählens",
  );
  assert.strictEqual(
    r.doubleTapBlocked,
    true,
    "AK4: kein Doppelzug währenddessen",
  );
})();

// --- AK3: Menschlicher Zug → KEIN erzwungenes Mitzählen ---------------------
(function ak3() {
  const r = run({ actor: 1, amount: 3 });
  assert.strictEqual(
    r.heapAfter[0],
    3,
    "menschlicher Zug funktioniert (3 weg)",
  );
  assert.strictEqual(r.lastMove, 3, "der Zug wird committed");
  assert.ok(
    r.countSteps.length === 0,
    "AK3: Menschlicher Zug zählt NICHT mit (Blase der KI leer), got: " +
      JSON.stringify(r.countSteps),
  );
  assert.strictEqual(r.activeAfter, 2, "Zugwechsel auch bei Mensch-Zug");
})();

console.log(
  "Issue 07 regression test passed (AI counts aloud in the speech bubble)",
);
