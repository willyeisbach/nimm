"use strict";

// Issue #14: Unit-Tests für die reine Spiel-Logik (nim.js) mit dem eingebauten
// Node-Test-Runner (node:test). Verhalten statt Implementierungsdetails;
// kein DOM. nim.js wird per require geladen (globalThis.window wird gesetzt),
// damit es derselben JS-Realm gehört und unter Coverage (c8) sichtbar ist.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// --- Test-Umgebung: window-Global mit deterministischem crypto.getRandomValues
//     (festes Wort), damit randomLegal reproduzierbar ist. Der echte
//     Mechanismus (crypto.getRandomValues) bleibt unverändert — nur der
//     Zufallsstrom wird für die Testlaufzeit gesteuert.
const FIXED_RANDOM_WORD = 0x01020304;
const originalGetRandomValues = globalThis.crypto.getRandomValues;
globalThis.crypto.getRandomValues = function (arr) {
  arr[0] = FIXED_RANDOM_WORD;
  return arr;
};
// nim.js liest sein Zufallsgerät über `window.crypto` — im Node-Test ist
// window === globalThis, so dass derselbe (gesteuerte) crypto-Strom gilt.
globalThis.window = globalThis;

// nim.js ist ein browser-Ziel-IIFE (kein module.exports): es hängt alles an
// window.Nim. require(...) lädt ihn in derselben Realm (Coverage-tauglich),
// das Ergebnis holen wir von globalThis.window.
require(path.join(__dirname, "..", "..", "nim.js"));
const Nim = globalThis.window.Nim;

test.after(() => {
  globalThis.crypto.getRandomValues = originalGetRandomValues;
});

// --------------------------------------------------------------------------
// parseAllowed — Regel-Parsing

test("parseAllowed: 'classic' liefert null (= jede Menge 1..Haufengröße)", () => {
  assert.equal(Nim.parseAllowed("classic", undefined), null);
});

test("parseAllowed: '4er' liefert [1,2,3,4] unabhängig von ownList", () => {
  assert.deepEqual(Nim.parseAllowed("4er", undefined), [1, 2, 3, 4]);
  assert.deepEqual(Nim.parseAllowed("4er", "9,11"), [1, 2, 3, 4]);
});

test("parseAllowed: 'own' parst eine korrekte Liste (dedupe + sort + '1'-Pflicht)", () => {
  assert.deepEqual(Nim.parseAllowed("own", "3, 1 ,2, 3"), [1, 2, 3]);
  assert.deepEqual(Nim.parseAllowed("own", "5,1"), [1, 5]);
});

test("parseAllowed: 'own' lehnt Ungültiges ab (leer, ohne 1, Nicht-Zahl, ≤0)", () => {
  assert.equal(Nim.parseAllowed("own", ""), null);
  assert.equal(Nim.parseAllowed("own", " 2, 3 "), null); // 1 fehlt
  assert.equal(Nim.parseAllowed("own", "a,1"), null);
  assert.equal(Nim.parseAllowed("own", "0, 1"), null);
  assert.equal(Nim.parseAllowed("own", undefined), null);
});

test("parseAllowed: unbekannte Regel lehnt ab (kein stiller Fallback)", () => {
  assert.equal(Nim.parseAllowed("nichts", undefined), null);
});

// --------------------------------------------------------------------------
// legalAmount / isLegal — Zug-Validierung

test("legalAmount: positive Ganze ≤ Haufengröße sind legal (klassisch)", () => {
  assert.ok(Nim.legalAmount("classic", null, 1, 3));
  assert.ok(Nim.legalAmount("classic", null, 3, 3));
});

test("legalAmount: über Haufengröße oder nicht-ganzzahlig ist illegal", () => {
  assert.equal(Nim.legalAmount("classic", null, 4, 3), false);
  assert.equal(Nim.legalAmount("classic", null, 0, 3), false);
  assert.equal(Nim.legalAmount("classic", null, -1, 3), false);
  assert.equal(Nim.legalAmount("classic", null, 1.5, 3), false);
});

test("legalAmount: Listen-Modus verlangt Wert ∈ A und ≤ Haufengröße", () => {
  const A = [1, 3, 5];
  assert.ok(Nim.legalAmount("own", A, 3, 3));
  assert.equal(Nim.legalAmount("own", A, 2, 5), false); // 2 ∉ A
  assert.equal(Nim.legalAmount("own", A, 5, 3), false); // 5 > Haufen 3
});

test("isLegal: prüft Position & Haufen-Index, verweigert leere/fehlende Haufen", () => {
  assert.ok(Nim.isLegal([4, 2], null, 0, 4));
  assert.ok(Nim.isLegal([4, 2], null, 1, 1));
  assert.equal(Nim.isLegal([4, 2], null, 3, 1), false); // Index außerhalb
  assert.equal(Nim.isLegal([0, 2], null, 0, 1), false); // leerer Haufen
  assert.equal(Nim.isLegal(null, null, 0, 1), false);
});

// --------------------------------------------------------------------------
// grundyTable — Grundy-Werte

test("grundyTable: klassisch g[n] = n (Basis 0)", () => {
  assert.deepEqual(Nim.grundyTable(5, null), [0, 1, 2, 3, 4, 5]);
});

test("grundyTable: Listen-Modus folgt der mex-Definition", () => {
  // A=[2] → g: 0,0,1,1,0,0 (nur um 2 wegbar)
  assert.deepEqual(Nim.grundyTable(5, [2]), [0, 0, 1, 1, 0, 0]);
  // A=[1,2] → g: 0,1,2,0,1,2
  assert.deepEqual(Nim.grundyTable(5, [1, 2]), [0, 1, 2, 0, 1, 2]);
});

test("grundyTable: ungültige Eingaben werfen (keine stillen Defaults)", () => {
  assert.throws(() => Nim.grundyTable(-1, null));
  assert.throws(() => Nim.grundyTable(1.5, null));
  assert.throws(() => Nim.grundyTable(3, [])); // leere Liste
});

// --------------------------------------------------------------------------
// nimSum — NIM-Summe

test("nimSum: klassisch = XOR der Haufengrößen", () => {
  assert.equal(Nim.nimSum([3], null), 3);
  assert.equal(Nim.nimSum([3, 3], null), 0); // gleiche Paare → N=0 (Verliererposition)
  assert.equal(Nim.nimSum([1, 2, 3], null), 0); // 1^2^3=0
  assert.equal(Nim.nimSum([1, 2, 4], null), 7); // 1^2^4=7
});

test("nimSum: Listen-Modus nutzt die Grundy-Werte des Listen-A", () => {
  // A=[2]: g = [0,0,1,1,0,...]; [2,3] → g(2)=1, g(3)=1 → N=0.
  assert.equal(Nim.nimSum([2, 3], [2]), 0);
  // [1,2] → g(1)=0, g(2)=1 → N=1.
  assert.equal(Nim.nimSum([1, 2], [2]), 1);
});

test("nimSum: leer/falsche Eingabe wirft", () => {
  assert.throws(() => Nim.nimSum(null, null));
  assert.throws(() => Nim.nimSum(["2"], null));
});

// --------------------------------------------------------------------------
// optimalMove — gewinnbringende Strategie

test("optimalMove: zwingt die NIM-Summe auf 0 (klassisch)", () => {
  // [1,2,4] hat N=7: Haufen 4 → T = 7 ^ g(4) = 7 ^ 4 = 3 → a mit g(4−a)=3 → a=1.
  assert.deepEqual(Nim.optimalMove([1, 2, 4], null), { heapIdx: 2, amount: 1 });
  // [3,3] (N=0): kein optimaler Zug → null.
  assert.equal(Nim.optimalMove([3, 3], null), null);
  // [1,1,1,1] (N=0): null.
  assert.equal(Nim.optimalMove([1, 1, 1, 1], null), null);
});

test("optimalMove: Listen-Modus — A=[1,2] (g: 0,1,2,0,…)", () => {
  // [3,3]: g(3)=0, N=0 → Verliererposition, kein optimaler Zug.
  assert.equal(Nim.optimalMove([3, 3], [1, 2]), null);
  // [2,2]: N=2^2=0 → ebenfalls null.
  assert.equal(Nim.optimalMove([2, 2], [1, 2]), null);
  // [2,1]: N=2^1=3 → optimal: Haufen 0 (n=2): T=3^g(2)=3^2=1, a mit g(2−a)=1 → a=1.
  assert.deepEqual(Nim.optimalMove([2, 1], [1, 2]), { heapIdx: 0, amount: 1 });
  assert.ok(Nim.isLegal([2, 1], [1, 2], 0, 1), "Der Zug muss legal sein");
});

test("optimalMove: keine Position, kein Heap → null (kein Crash, kein Zug)", () => {
  assert.equal(Nim.optimalMove([], null), null);
  assert.equal(Nim.optimalMove([0, 0], null), null);
});

// --------------------------------------------------------------------------
// randomLegal — reproduzierbarer legaler Zufall (deterministisches crypto-Wort)

test("randomLegal: deterministisch gesteuert (festes crypto-Wort)", () => {
  // [1,3] klassisch: Paare [(0,1),(1,1),(1,2),(1,3)] → Index 0x01020304 % 4 = 0.
  assert.deepEqual(Nim.randomLegal([1, 3], null), { heapIdx: 0, amount: 1 });
  // [4] klassisch: Paare [(0,1),(0,2),(0,3),(0,4)] → Index 0 → {heapIdx:0, amount:1}.
  assert.deepEqual(Nim.randomLegal([4], null), { heapIdx: 0, amount: 1 });
});

test("randomLegal: nur legale Züge zurückgeben (Listen-Modus)", () => {
  const A = [1, 3];
  const m = Nim.randomLegal([3, 2], A);
  assert.ok(m);
  assert.equal(Nim.isLegal([3, 2], A, m.heapIdx, m.amount), true);
});

test("randomLegal: keine Position → wirft (kein stiller Noop)", () => {
  assert.throws(() => Nim.randomLegal([], null));
});

// --------------------------------------------------------------------------
// Defensive Guards — ungültige Fremd-Eingaben werden abgelehnt, nicht still akzeptiert

test("defensive guards: Typ-Fehler bei heapSize / heapIdx / Position werden abgelehnt", () => {
  // heapSize als String: abgelehnt (statt still coerced).
  assert.equal(Nim.legalAmount("classic", null, 1, "3"), false);
  // heapIdx als Bruchzahl: abgelehnt.
  assert.equal(Nim.isLegal([4], null, 1.5, 1), false);
  // randomLegal mit Nicht-Array: wirft (statt leiser Noop).
  assert.throws(() => Nim.randomLegal("1,2", null));
});
