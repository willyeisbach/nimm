// nim.js – Zugregel, Grundy-Tabelle, Legitimität (Logik kommt in Task 2–4)
// Reines Logik-Modul: keine DOM-/UI-Abhängigkeiten, ES2020, kein import/export.
window.Nim = window.Nim || {};

(function (Nim) {
  "use strict";

  // Interner Helfer: Ist ein einzelner Token eine positive Ganzzahl ≥ 1?
  function isPositiveIntToken(token) {
    if (typeof token !== "string") {
      return false;
    }
    const trimmed = token.trim();
    if (!/^\d+$/.test(trimmed)) {
      return false;
    }
    return parseInt(trimmed, 10) >= 1;
  }

  // Interner Helfer: parst eine "own"-Liste (Kommazahlen-String) zu einer
  // deduplizierten, aufsteigend sortierten Liste erlaubter Mengen.
  // Ungültig (leer, nicht-numerisch, ≤ 0, fehlendes 1) → null.
  function parseOwnList(ownList) {
    if (typeof ownList !== "string") {
      return null;
    }
    const tokens = ownList.split(",").map(function (t) { return t.trim(); });
    const nonEmpty = tokens.filter(function (t) { return t.length > 0; });
    if (nonEmpty.length === 0) {
      return null;
    }

    const amounts = [];
    for (let i = 0; i < nonEmpty.length; i++) {
      if (!isPositiveIntToken(nonEmpty[i])) {
        return null;
      }
      amounts.push(parseInt(nonEmpty[i], 10));
    }

    // "1" muss enthalten sein, sonst ist der Zug auf den Spielende blockiert.
    if (amounts.indexOf(1) === -1) {
      return null;
    }

    // Duplikate entfernen, aufsteigend sortieren.
    return Array.from(new Set(amounts)).sort(function (a, b) { return a - b; });
  }

  /**
   * Nim.parseAllowed(rule, ownList) → erlaubte Mengen A (Array) oder null.
   *   "classic" → null   (= "jede Menge 1..Haufengröße", Sonderwert)
   *   "4er"     → [1,2,3,4]
   *   "own"     → geparste, deduplizierte, sortierte Liste; ungültig → null
   *   sonst     → null
   */
  Nim.parseAllowed = function (rule, ownList) {
    switch (rule) {
      case "classic":
        return null;
      case "4er":
        return [1, 2, 3, 4];
      case "own":
        return parseOwnList(ownList);
      default:
        return null;
    }
  };

  /**
   * Nim.legalAmount(rule, A, amount, heapSize) → boolean
   * Menge `amount` aus einem Haufen der Größe `heapSize` ist legal, wenn:
   *   - `amount` positive Ganzzahl ≥ 1,
   *   - `amount ≤ heapSize`,
   *   - Listen-Modi (`A` ist Array): zusätzlich `amount ∈ A`.
   * Klassisch (`A === null`): `amount ≤ heapSize` genügt.
   */
  Nim.legalAmount = function (rule, A, amount, heapSize) {
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1) {
      return false;
    }
    if (typeof heapSize !== "number" || !Number.isInteger(heapSize) || heapSize < 0) {
      return false;
    }
    if (amount > heapSize) {
      return false;
    }
    if (A !== null && A !== undefined) {
      return A.indexOf(amount) !== -1;
    }
    return true;
  };

  // Interne Caches: Grundy-Tabelle pro (A, maxStone) einmal berechnen.
  // A ist `null` (klassisch) oder ein Array; als Key wird ein deterministischer
  // String genutzt, damit Array-Identität irrelevant bleibt.
  const groundyClassicCache = Object.create(null); // key: maxStone
  const groundyListCache = Object.create(null);    // key: "A|:|-joined|maxStone"

  // Internal helper: smallest excluded (non-negative) number of a set of values.
  function mex(reachable) {
    const seen = {};
    for (let i = 0; i < reachable.length; i++) {
      const v = reachable[i];
      if (v >= 0) {
        seen[v] = true;
      }
    }
    let m = 0;
    while (seen[m]) {
      m += 1;
    }
    return m;
  }

  /**
   * Nim.grundyTable(maxStone, A) → Array g[0..maxStone] (Länge maxStone+1).
   *   g[0] = 0
   *   g[n] = mex( { g[n - a] : a ∈ A, a ≤ n } )
   * Klassisch (`A === null`): Shortcut g[n] = n.
   * Ergebnis wird pro (A, maxStone) gecacht.
   */
  Nim.grundyTable = function (maxStone, A) {
    if (typeof maxStone !== "number" || !Number.isInteger(maxStone) || maxStone < 0) {
      throw new Error("Nim.grundyTable: maxStone muss eine nicht-negative Ganzzahl sein.");
    }

    if (A === null || A === undefined) {
      // Klassisch: g[n] = n.
      if (Object.prototype.hasOwnProperty.call(groundyClassicCache, maxStone)) {
        return groundyClassicCache[maxStone];
      }
      const g = new Array(maxStone + 1);
      for (let n = 0; n <= maxStone; n++) {
        g[n] = n;
      }
      groundyClassicCache[maxStone] = g;
      return g;
    }

    // Listen-Modus: A muss ein Array positiver, ganzzahliger Mengen sein.
    if (!Array.isArray(A) || A.length === 0) {
      throw new Error("Nim.grundyTable: A muss null oder ein nicht-leeres Array sein.");
    }

    const key = A.join("|") + "#" + maxStone;
    if (Object.prototype.hasOwnProperty.call(groundyListCache, key)) {
      return groundyListCache[key];
    }

    const g = new Array(maxStone + 1);
    g[0] = 0;
    for (let n = 1; n <= maxStone; n++) {
      const reachable = [];
      for (let i = 0; i < A.length; i++) {
        const a = A[i];
        if (a <= n) {
          reachable.push(g[n - a]);
        }
      }
      g[n] = mex(reachable);
    }
    groundyListCache[key] = g;
    return g;
  };

  /**
   * Nim.nimSum(position, A) → Zahl
   * NIM-Summe N = g(n1) XOR g(n2) XOR … über die Haufengrößen in `position`.
   * A = null → Klassisch, sonst Listen-Modi (A aus parseAllowed, Task 02).
   */
  Nim.nimSum = function (position, A) {
    if (!Array.isArray(position)) {
      throw new Error("Nim.nimSum: position muss ein Array sein.");
    }
    const maxStone = position.length > 0 ? Math.max.apply(null, position) : 0;
    const g = Nim.grundyTable(maxStone, A); // gecacht (Task 03)
    let n = 0;
    for (let i = 0; i < position.length; i++) {
      const size = position[i];
      if (typeof size !== "number" || !Number.isInteger(size) || size < 0) {
        throw new Error("Nim.nimSum: Haufengrößen müssen nicht-negative Ganzzahlen sein.");
      }
      n ^= g[size];
    }
    return n;
  };

  /**
   * Nim.isLegal(position, A, heapIdx, amount) → boolean
   * Regelableitung aus A: A === null → Klassisch, A ist Array → Listen-Modus.
   * (Doku, wie in Task 04 gefordert: die Regel wird intern aus A abgeleitet;
   *  `legalAmount` selbst nutzt nur `A` und `heapSize`.)
   */
  Nim.isLegal = function (position, A, heapIdx, amount) {
    if (!Array.isArray(position)) {
      return false;
    }
    if (typeof heapIdx !== "number" || !Number.isInteger(heapIdx)) {
      return false;
    }
    if (heapIdx < 0 || heapIdx >= position.length) {
      return false;
    }
    const heapSize = position[heapIdx];
    if (typeof heapSize !== "number" || heapSize < 1) {
      return false;
    }
    const rule = (A === null || A === undefined) ? "classic" : "list";
    return Nim.legalAmount(rule, A, amount, heapSize);
  };

  // Interne Helfer: legaler-Mengen-Liste für einen Haufen, aufsteigend.
  // Klassisch (A === null): [1..heapSize]; Listen-Modus: A-Elemente ≤ heapSize.
  function legalAmountsFor(A, heapSize) {
    if (A === null || A === undefined) {
      const out = new Array(heapSize);
      for (let a = 1; a <= heapSize; a++) {
        out[a - 1] = a;
      }
      return out;
    }
    const out = [];
    for (let i = 0; i < A.length; i++) {
      if (A[i] <= heapSize) {
        out.push(A[i]);
      }
    }
    return out;
  }

  /**
   * Nim.optimalMove(position, A) → { heapIdx, amount } | null
   * NIM-Strategie: N = nimSum; N === 0 → null (Verliererposition).
   * Sonst: Haufen i mit target = N XOR g(n_i) und Menge a mit g(n_i - a) === target.
   */
  Nim.optimalMove = function (position, A) {
    const maxStone = Array.isArray(position) && position.length > 0
      ? Math.max.apply(null, position) : 0;
    const g = Nim.grundyTable(maxStone, A);

    const N = Nim.nimSum(position, A);
    if (N === 0) {
      return null;
    }

    for (let i = 0; i < position.length; i++) {
      const n = position[i];
      if (n < 1) {
        continue;
      }
      const target = N ^ g[n];
      const amounts = legalAmountsFor(A, n);
      for (let j = 0; j < amounts.length; j++) {
        const a = amounts[j];
        if (g[n - a] === target) {
          return { heapIdx: i, amount: a };
        }
      }
    }
    // Theoretisch unerreichbar (N ≠ 0 garantiert einen Gewinnzug), aber sicher.
    return null;
  };

  // Interner Helfer: kryptographisch zufällige Index-Zahl in [0, list.length).
  function randomIndex(list) {
    const buf = new Uint32Array(1);
    window.crypto.getRandomValues(buf);
    return buf[0] % list.length;
  }

  /**
   * Nim.randomLegal(position, A) → { heapIdx, amount }
   * Wählt zufällig ein Paar aus allen legalen (heapIdx, a)-Paaren,
   * Zufall via window.crypto.getRandomValues (arch §3.1).
   */
  Nim.randomLegal = function (position, A) {
    if (!Array.isArray(position)) {
      throw new Error("Nim.randomLegal: position muss ein Array sein.");
    }
    const pairs = [];
    for (let i = 0; i < position.length; i++) {
      const n = position[i];
      if (typeof n !== "number" || n < 1) {
        continue;
      }
      const amounts = legalAmountsFor(A, n);
      for (let j = 0; j < amounts.length; j++) {
        pairs.push({ heapIdx: i, amount: amounts[j] });
      }
    }
    if (pairs.length === 0) {
      throw new Error("Nim.randomLegal: kein legaler Zug vorhanden (Spielende).");
    }
    return pairs[randomIndex(pairs)];
  };
})(window.Nim);
