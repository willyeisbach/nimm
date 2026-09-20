// ai.js – KI-Charaktere Baxi / Ducola / Muisa
// Reines Strategie-Modul: keine DOM-/UI-Abhängigkeiten, ES2020, kein import/export.
// Abhängig (einseitig) von window.Nim (nim.js); keine eigene Grundy-/NIM-Logik (arch §2.1).
window.AI = window.AI || {};

(function (AI, Nim) {
  "use strict";

  // Interne Helfer: Index eines der größten Haufen (Gleichstand: erster gefundener).
  // Bei leerer Position liefert -1 (Spielende, kein Zug möglich).
  function largestHeapIdx(position) {
    let best = -1;
    let bestSize = -1;
    for (let i = 0; i < position.length; i++) {
      const size = position[i];
      if (typeof size === "number" && size > bestSize) {
        bestSize = size;
        best = i;
      }
    }
    return best;
  }

  // Interner Helfer: "wie Baxi" (Spät-Zweig, req §4.2) — wird von Baxi, Ducola
  // und Muisa (S ≤ 5) gemeinsam genutzt:
  //   N ≠ 0 → optimaler Zug (NIM-Summe auf 0 zwingen), delegiert an Nim.optimalMove.
  //   N = 0 → Verliererposition: kleinstmögliche Menge (= 1, da 1 ∈ A) aus dem größten Haufen.
  function optimalOrFallback(position, A) {
    if (Nim.nimSum(position, A) !== 0) {
      return Nim.optimalMove(position, A);
    }
    return { heapIdx: largestHeapIdx(position), amount: 1 };
  }

  // Interner Helfer: wendet { heapIdx, amount } an und liefert die neue Position.
  function applyMove(position, move) {
    const next = position.slice();
    next[move.heapIdx] -= move.amount;
    return next;
  }

  // Interner Helfer: kryptographisch zufälliger Index in [0, n) via crypto.
  function randomIndexBelow(n) {
    const buf = new Uint32Array(1);
    window.crypto.getRandomValues(buf);
    return buf[0] % n;
  }

  // Ducola – großzügig früh, optimal spät (req §4.3):
  //   S > 10  → legaler Zug, nach dem N' ≠ 0 (lässt dem Gegner eine Gewinnposition);
  //             zufällig unter allen solchen Zügen; falls keiner → Nim.randomLegal.
  //   S ≤ 10  → wie Baxi (optimal).
  function ducolaMove(position, A) {
    const total = position.reduce(function (s, n) {
      return s + n;
    }, 0);
    if (total <= 10) {
      return optimalOrFallback(position, A);
    }
    // Alle legalen Züge sammeln, die dem Gegner eine Gewinnposition (N' ≠ 0) lassen.
    const candidates = [];
    for (let i = 0; i < position.length; i++) {
      const n = position[i];
      if (typeof n !== "number" || n < 1) {
        continue;
      }
      for (let a = 1; a <= n; a++) {
        if (!Nim.isLegal(position, A, i, a)) {
          continue;
        }
        const next = applyMove(position, { heapIdx: i, amount: a });
        if (Nim.nimSum(next, A) !== 0) {
          candidates.push({ heapIdx: i, amount: a });
        }
      }
    }
    if (candidates.length === 0) {
      // Fallback (req §4.3): kein Zug mit N' ≠ 0 möglich → zufälliger legaler Zug.
      return Nim.randomLegal(position, A);
    }
    return candidates[randomIndexBelow(candidates.length)];
  }

  // Muisa – zufällig früh, optimal spät (req §4.4):
  //   S > 5  → zufälliger legaler Zug (Nim.randomLegal).
  //   S ≤ 5  → wie Baxi (optimal).
  function muisaMove(position, A) {
    const total = position.reduce(function (s, n) {
      return s + n;
    }, 0);
    if (total <= 5) {
      return optimalOrFallback(position, A);
    }
    return Nim.randomLegal(position, A);
  }

  /**
   * AI.chooseMove(position, A, who) → { heapIdx, amount }
   *   position = Haufengrößen-Array,
   *   A        = erlaubte Mengen aus nim.js (`null` = klassisch, sonst Array),
   *   who      = Charakter-Name ("Baxi" | "Ducola" | "Muisa").
   * Einzige öffentliche Schnittstelle, die game.js später braucht (arch §3.8).
   */
  AI.chooseMove = function (position, A, who) {
    if (who === "Baxi") {
      return optimalOrFallback(position, A);
    }
    if (who === "Ducola") {
      return ducolaMove(position, A);
    }
    if (who === "Muisa") {
      return muisaMove(position, A);
    }
    throw new Error(
      'AI.chooseMove: unbekannter KI-Charakter "' +
        who +
        '" (unterstützt: "Baxi", "Ducola", "Muisa").',
    );
  };
})(window.AI, window.Nim);
