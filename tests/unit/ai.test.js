"use strict";

// Issue #14: Unit-Tests für die KI-Strategien (ai.js) mit dem eingebauten
// Node-Test-Runner (node:test). Verhalten statt Implementierungsdetails:
// jede Charakterstrategie (Baxi optimal / Ducola großzügig-früh / Muisa
// zufällig-früh) wird anhand ihrer spieltheoretischen Eigenschaften geprüft.
//
// Zufall: window.crypto.getRandomValues ist durch ein festes Wort gesteuert
// → die sonst „zufälligen" Züge sind in den Tests reproduzierbar, ohne den
// Produktionscode (echtes crypto) zu schwächen.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const FIXED_RANDOM_WORD = 0x01020304;
const originalGetRandomValues = globalThis.crypto.getRandomValues;
globalThis.crypto.getRandomValues = function (arr) {
  arr[0] = FIXED_RANDOM_WORD;
  return arr;
};
// ai.js/nim.js liest ihr Zufallsgerät über `window.crypto` — im Node-Test ist
// window === globalThis, so dass derselbe (gesteuerte) crypto-Strom gilt.
globalThis.window = globalThis;

// ai.js ist ein browser-Ziel-IIFE (kein module.exports, hängt an window.AI,
// benötigt window.Nim). Beide per require in derselben Realm laden.
require(path.join(__dirname, "..", "..", "nim.js"));
require(path.join(__dirname, "..", "..", "ai.js"));
const Nim = globalThis.window.Nim;
const AI = globalThis.window.AI;

const host = (v) => JSON.parse(JSON.stringify(v));
const isWinningForNext = (pos, A) => Nim.nimSum(pos, A) !== 0;

test.after(() => {
  globalThis.crypto.getRandomValues = originalGetRandomValues;
});

// --- Baxi: immer optimal (Spieltheorie), egal wie groß die Position --------

test("Baxi: Gewinnposition (N≠0) zwingt die NIM-Summe auf 0", () => {
  const m = AI.chooseMove([1, 2, 4], null, "Baxi");
  assert.deepEqual(m, { heapIdx: 2, amount: 1 });
  // Der Zug muss legal sein und exakt N'=0 hinterlassen.
  assert.ok(Nim.isLegal([1, 2, 4], null, m.heapIdx, m.amount));
  const next = [1, 2, 4].slice();
  next[m.heapIdx] -= m.amount;
  assert.equal(isWinningForNext(next, null), false);
});

test("Baxi: Verliererposition (N=0) → kleinstmögliche Menge (1) aus dem größten Haufen", () => {
  // [3,3]: N=3^3=0 → Fallback. Größter Haufen = Haufen 0 (erster im Gleichstand).
  assert.deepEqual(AI.chooseMove([3, 3], null, "Baxi"), {
    heapIdx: 0,
    amount: 1,
  });
  // [2,2]: N=2^2=0 → Fallback 1 aus Haufen 0.
  assert.deepEqual(AI.chooseMove([2, 2], null, "Baxi"), {
    heapIdx: 0,
    amount: 1,
  });
  // [1,2,3]: N=0 → Fallback: größter Haufen = 3 (Haufen 2) → 1 aus Haufen 2.
  assert.deepEqual(AI.chooseMove([1, 2, 3], null, "Baxi"), {
    heapIdx: 2,
    amount: 1,
  });
});

test("Baxi: Listen-Modus nutzt die Grundy-Werte von A", () => {
  // A=[2]: g = [0,0,1,1,0,...]. [2,4]: N = g(2) ^ g(4) = 1 ^ 0 = 1 ≠ 0 → optimal.
  // Haufen 0 (n=2): T = N ^ g(2) = 1 ^ 1 = 0 → a mit g(2−a)=0 → a=2.
  assert.deepEqual(AI.chooseMove([2, 4], [2], "Baxi"), {
    heapIdx: 0,
    amount: 2,
  });
  assert.ok(Nim.isLegal([2, 4], [2], 0, 2));
});

test("Baxi: leerer Haufen wird übersprungen", () => {
  // [0,5]: Haufen 0 leer, Haufen 1 mit 5 → N=5 → optimal: 5 aus Haufen 1.
  assert.deepEqual(AI.chooseMove([0, 5], null, "Baxi"), {
    heapIdx: 1,
    amount: 5,
  });
});

// --- Ducola: großzügig früh (S > 10), optimal spät (S ≤ 10) ----------------

test("Ducola: S ≤ 10 (einschließlich Grenze) zieht optimal", () => {
  // [10]: S=10 → optimal: 10 aus Haufen 0.
  assert.deepEqual(AI.chooseMove([10], null, "Ducola"), {
    heapIdx: 0,
    amount: 10,
  });
  // [5,4]: S=9, N=5^4=1 → Haufen 0: T = 1^g(5) = 1^5 = 4 → a mit g(5−a)=4 → a=1.
  assert.deepEqual(AI.chooseMove([5, 4], null, "Ducola"), {
    heapIdx: 0,
    amount: 1,
  });
});

test("Ducola: S > 10 lässt dem Gegner bewusst eine Gewinnposition (N'≠0)", () => {
  // [5,6]: S=11, N=5^6=3. Kandidaten = alle legalen Züge mit N'≠0:
  // heap 0 → a=1..5 (N' = a'^6 ≠ 0 für alle a ≤ 5; a=6 → [0,6] auch N'≠0) — hier
  // klassisch: alle 11 Züge wären Kandidaten, AUSSCHLAGSEBEND ist Index 0:
  // 0x01020304 % 11 = 0 → {heapIdx:0, amount:1} (N' = 4^6 = 2 ≠ 0).
  const m = AI.chooseMove([5, 6], null, "Ducola");
  assert.deepEqual(m, { heapIdx: 0, amount: 1 });
  assert.ok(Nim.isLegal([5, 6], null, m.heapIdx, m.amount));
  const next = [5, 6];
  next[m.heapIdx] -= m.amount;
  assert.equal(
    isWinningForNext(next, null),
    true,
    "Ducola lässt N'≠0 (Gegner in Gewinnposition)",
  );
});

test("Ducola: alle Züge würden N'=0 lassen → Fallback auf einen legalen (zufälligen) Zug", () => {
  // A=[3]: g(n) = floor(n/3) mod 2 → jede legale Zug (a=3) ändert N um XOR-1.
  // [3,3,3,6]: S=15 > 10, N = 1^1^1^0 = 1 = genau dann, wenn KEINE Zug N'≠0
  // liefern kann (alle 4 legalen Züge liefern N'=0) → Ducolas „großzügiger"
  // Pfad findet keine Kandidaten und fällt deterministisch auf randomLegal
  // zurück: Paare [(0,3),(1,3),(2,3),(3,3)], Index 0x01020304 % 4 = 0
  // → {heapIdx:0, amount:3}.
  const pos = [3, 3, 3, 6];
  const A = [3];
  assert.equal(Nim.nimSum(pos, A), 1, "Setup-Prämisse: N=1");
  assert.ok(pos.reduce((s, n) => s + n, 0) > 10, "Setup-Prämisse: S>10");
  const m = AI.chooseMove(pos, A, "Ducola");
  assert.deepEqual(m, { heapIdx: 0, amount: 3 });
  assert.ok(
    Nim.isLegal(pos, A, m.heapIdx, m.amount),
    "Fallback-Zug muss legal sein",
  );
});

// --- Muisa: zufällig früh (S > 5), optimal spät (S ≤ 5) ---------------------

test("Muisa: S > 5 → legaler (deterministisch gesteuerter) Zufallszug", () => {
  // [6, 1]: S=7 → randomLegal, Paare: heap0 a=1..6 + heap1 a=1 = 7 Paare.
  // 0x01020304 % 7 = 0 → {heapIdx:0, amount:1} (muss legal sein).
  const m = AI.chooseMove([6, 1], null, "Muisa");
  assert.deepEqual(m, { heapIdx: 0, amount: 1 });
  assert.ok(Nim.isLegal([6, 1], null, m.heapIdx, m.amount));
});

test("Muisa: S ≤ 5 (einschließlich Grenze) → optimal wie Baxi", () => {
  // [5]: S=5 → optimal: 5 aus Haufen 0.
  assert.deepEqual(AI.chooseMove([5], null, "Muisa"), {
    heapIdx: 0,
    amount: 5,
  });
  // [3,2]: S=5 → N=1 → 1 aus Haufen 0.
  assert.deepEqual(AI.chooseMove([3, 2], null, "Muisa"), {
    heapIdx: 0,
    amount: 1,
  });
});

test("Muisa: Verliererposition (S ≤ 5, N=0) → Fallback 1 aus größtem Haufen", () => {
  assert.deepEqual(AI.chooseMove([2, 2], null, "Muisa"), {
    heapIdx: 0,
    amount: 1,
  });
});

// --- API-Randbedingungen -----------------------------------------------------

test("chooseMove: unbekannter Charakter wirft (kein stiller Default-KI)", () => {
  assert.throws(() => AI.chooseMove([1, 2], null, "Nobody"));
  assert.throws(() => AI.chooseMove([1, 2], null, "baxi")); // Groß-/Kleinschreibung
});

test("alle Ki-Positionen liefern nur Züge auf existierenden, nicht-leeren Haufen", () => {
  // Invarianten über alle Charaktere — schützt gegen Regressionen, bei denen
  // ein Charakter auf einen leeren Haufen oder außerhalb schreibt.
  const positions = [
    [1, 1, 10],
    [10, 0, 3],
    [0, 0, 8],
    [7, 2],
  ];
  for (const who of ["Baxi", "Ducola", "Muisa"]) {
    for (const pos of positions) {
      const m = AI.chooseMove(pos, null, who);
      assert.ok(
        m &&
          Number.isInteger(m.heapIdx) &&
          m.heapIdx >= 0 &&
          m.heapIdx < pos.length,
        `${who}: Zug-Index außerhalb — ${JSON.stringify(m)}`,
      );
      assert.ok(
        m.amount >= 1 && m.amount <= pos[m.heapIdx],
        `${who}: unlegale Menge — ${JSON.stringify(m)} auf ${JSON.stringify(pos)}`,
      );
    }
  }
});
