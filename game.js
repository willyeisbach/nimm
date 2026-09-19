// game.js – Spielzustand, UI-Verdrahtung, Animation, Charaktere, Optionen,
// Rückgängig (Logik in Task 8+). Kinderfreundliche NIMM!-Ausbaustufe.
window.Game = window.Game || {};

(function (Game) {
  "use strict";

  // --- Sprachmaterial für die Charaktere (nur für Kinder, kein Grundy-Gebrausch) ---
  const AI_IDLE_FACES = { Baxi: "😼", Ducola: "😺", Muisa: "😸" };
  const THINK_LINES = ["Hmm, hmm, hmm…", "Wo nimmst du's wohl zuerst weg? 🤔", "Ich zähle die Rosinen…"];
  const AI_LAUGH_LINES = [
    "Hahaha! Aha, da machst du mal einen Fehler! 😆",
    "Oha, oha, oha! So nicht! 🤭",
    "Du hast mir gerade eine Rosine geschenkt! 🤦"
  ];
  const AI_WIN_LINES = [
    "YESSS! Die Rosinen sind MEINE! 😤",
    "Hab' ich dir gesagt? Ich bin doch gut. 😏",
    "Nächste Runde wird's dir richtig gezeigt!"
  ];
  const AI_ANGRY_LINES = [
    "Uuugh, das stinkt! Ich krieg' das NIEHT! 😠",
    "Hmpf! Du hast doch die ganze Zeit schon gewonnen… äh, ICH!? 🙄",
    "Nicht lustig! Das ist kein Fair-Play! 😤",
    "Ugh, meine Rosinen! Warum immer ich! 😠"
  ];
  const AI_LOSE_LINES = [
    "NEIN!!! Meine Rosinen! 😠",
    "Hmpf! Unfair! Du hast doch gerade verloren… äh, ICH! 😤",
    "Das war kein Spiel! Das war ein Verbrechen! 🙄",
    "Nicht lustig! Nächstes Mal gewinne ICH – sag's der Schule!"
  ];
  const HUMAN_WIN_LINES = [
    "YAY! Alle Rosinen sind meins! 🥳",
    "Ich bin die Rosinen-Königin! 🤴"
  ];
  const UNDO_HINT_LINES = [
    "Pech gehabt – du darfst jetzt nochmal! 😄",
    "Zurückgerutscht! Nochmal versuchen! 💪"
  ];

  function randomInList(list) {
    return list[Math.floor(Math.random() * list.length)] || list[0];
  }

  /**
   * Zufallszahl in [min, max] (ganzzahlig, beide Enden inklusiv) über
   * window.crypto.getRandomValues (s. architecture.md §3.1).
   */
  function randomInt(min, max) {
    const range = max - min + 1;
    if (range <= 0) {
      throw new Error("Game.randomInt: max muss ≥ min sein.");
    }
    const maxWord = 0xFFFFFFFF;
    const limit = maxWord - (maxWord % range);
    const buf = new Uint32Array(1);
    let x;
    do {
      window.crypto.getRandomValues(buf);
      x = buf[0];
    } while (x > limit);
    return min + (x % range);
  }

  /**
   * Game.defaults() → Default-Konfiguration (req §3.1) + neue UX-Optionen.
   */
  Game.defaults = function () {
    return {
      maxHaufen: 1,
      rule: "4er",
      maxSteine: 20,
      minSteine: 10,
      opponent: "Mensch",
      name1: "Spieler 1",
      name2: "Spieler 2",
      startPlayer: "random", // "random" | "1" | "2"
      undoEnabled: false
    };
  };

  /**
   * Spielzustand im Speicher (keine Persistenz, req §1).
   */
  Game.state = {
    // Konfiguration
    maxHaufen: 1,
    rule: "4er",
    maxSteine: 20,
    minSteine: 10,
    opponent: "Mensch",
    name1: "Spieler 1",
    name2: "Spieler 2",
    startPlayer: "random",
    undoEnabled: false,
    ownList: undefined, // nur bei rule === "own" gesetzt (Raw-String)
    // Laufzeit-Zustand
    heaps: [],         // Array der aktuellen Haufengrößen
    active: 1,         // 1 oder 2 (aktiver Spieler)
    lastMove: null,    // null oder { player, heapIdx, amount }
    selectedHeap: 0,   // 0-basiert: ausgewählter Ziel-Haufen
    allowed: null,     // erlaubte Mengen A (null = klassisch)
    lock: false,       // true während Animation/KI-Zug
    faces: null,       // {1:"🙂",2:"😼"} – aktuelle Gesichter (null = idle)
    bubble: {},        // {1/2: Sprechblasen-Text}
    undoStack: []      // Zug-Stapel für Rückgängig (Snapshots)
  };

  function firstNonEmptyHeap(heaps) {
    for (let i = 0; i < heaps.length; i++) {
      if (heaps[i] >= 1) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Game.isAI(opponentName) → boolean. Ist der Name ein KI-Charakter?
   */
  Game.isAI = function (opponentName) {
    return opponentName === "Baxi" || opponentName === "Ducola" || opponentName === "Muisa";
  };

  /**
   * Game.isLocked() → boolean (Task 11).
   * Zentrale Abfrage, ob während Animation/KI-Zug gesperrt ist.
   */
  Game.isLocked = function () {
    return Game.state.lock === true;
  };

  /**
   * Game.newHeaps() → Array von Haufengrößen.
   *   Anzahl = Zufall in [1, maxHaufen], jeder Haufen = Zufall in
   *   [minSteine, maxSteine] (alle unabhängig), aus Game.state gelesen.
   */
  Game.newHeaps = function () {
    const s = Game.state;
    const count = randomInt(1, s.maxHaufen);
    const heaps = new Array(count);
    for (let i = 0; i < count; i++) {
      heaps[i] = randomInt(s.minSteine, s.maxSteine);
    }
    if (s.minSteine === 0 && s.maxSteine >= 1 && firstNonEmptyHeap(heaps) === -1) {
      heaps[0] = 1;
    }
    return heaps;
  };

  /**
   * Game.idleFaces() → {1: Gesicht, 2: Gesicht} für den ruhigen Zustand.
   * KI-Charaktere bekommen ihre Haustyp-Gesichter, Menschen ein 🙂.
   */
  Game.idleFaces = function () {
    const s = Game.state;
    const aiFace = Game.isAI(s.opponent) ? (AI_IDLE_FACES[s.opponent] || "😼") : "🙂";
    return { 1: "🙂", 2: aiFace };
  };

  /**
   * Game.setFace(player, face) → void. Setzt ein Gesicht für Spieler 1/2.
   */
  Game.setFace = function (player, face) {
    const s = Game.state;
    s.faces = s.faces || {};
    s.faces[player] = face;
  };

  /**
   * Game.setBubble(player, text) → void. Setzt die Sprechblase eines Spielers.
   */
  Game.setBubble = function (player, text) {
    const s = Game.state;
    s.bubble = s.bubble || {};
    s.bubble[player] = text;
  };

  /**
   * Game.clearBubbles() → void. Alle Sprechblasen leeren.
   */
  Game.clearBubbles = function () {
    Game.state.bubble = {};
  };

  /**
   * Game.resetFaces() → void. Gesichter auf die idle-Varianten zurücksetzen.
   */
  Game.resetFaces = function () {
    Game.state.faces = Game.idleFaces();
  };

  /**
   * Game.renderCharacters() → spiegelt Name/Rolle/Gesicht/Sprechblase der
   * beiden Spieler-Cards im DOM (wenn vorhanden).
   */
  Game.renderCharacters = function () {
    if (typeof document === "undefined") {
      return;
    }
    const s = Game.state;
    const faces = s.faces || Game.idleFaces();
    for (let p = 1; p <= 2; p++) {
      const card = document.querySelector("#char-" + p);
      if (!card) {
        continue;
      }
      const name = p === 1 ? s.name1 : s.name2;
      const role = p === 1
        ? "du"
        : (s.opponent === "Mensch" ? "Spieler 2" : s.opponent + " (KI)");
      card.className = "char-card" + (s.active === p ? " active" : "");
      const faceEl = card.querySelector(".char-face");
      if (faceEl) {
        faceEl.textContent = faces[p] || "🙂";
      }
      const nameEl = card.querySelector(".char-name");
      if (nameEl) {
        nameEl.textContent = name;
      }
      const roleEl = card.querySelector(".char-role");
      if (roleEl) {
        roleEl.textContent = role;
      }
      const bubble = card.querySelector(".bubble");
      if (bubble) {
        const text = (s.bubble || {})[p] || "";
        bubble.textContent = text;
        bubble.className = "bubble" +
          (text && faces[p] === "😠" ? " bubble-angry" : "");
      }
    }
  };

  /**
   * Game.start() → frischer Spielzustand (idempotent).
   * Setzt Haufen, Startspieler (zufällig/wählbar), lastMove/lock zurück,
   * leitet die erlaubten Mengen A aus der Regel ab und ruft die neue
   * Sprechblase + Characters-Rendering auf.
   */
  Game.start = function () {
    const s = Game.state;
    Game._moveSeq = (Game._moveSeq || 0) + 1;
    Game.cancelAIMove();
    try {
      s.heaps = Game.newHeaps();
    } catch (e) {
      console.error("Haufengenerierung fehlgeschlagen:", e);
      return;
    }
    if (s.startPlayer === "1") {
      s.active = 1;
    } else if (s.startPlayer === "2") {
      s.active = 2;
    } else {
      s.active = randomInt(1, 2);
    }
    s.lastMove = null;
    s.lock = false;
    s.allowed = window.Nim.parseAllowed(s.rule, s.ownList);
    s.selectedHeap = firstNonEmptyHeap(s.heaps);
    s.undoStack = [];
    s.faces = Game.idleFaces();
    s.bubble = {};

    // Friendly Begrüßung: wer beginnt, sagt's kurz.
    if (s.active === 1) {
      s.bubble[1] = "Wer nimmt die letzte Rosine? 😋";
    } else if (Game.isAI(s.opponent)) {
      s.bubble[2] = "Ich fange an – halt dich fest! " + (AI_IDLE_FACES[s.opponent] || "😼");
    } else {
      s.bubble[2] = "Ich bin bereit! 😊";
    }

    Game.render();
    Game.renderUndoButton();
    Game.maybeAIMove();
    return s;
  };

  /**
   * Game.maxAllowable(heapIdx) → größte erlaubte Nehm-Menge für diesen Haufen
   * (Klassisch: Haufengröße; Listen-Modus: größtes A-Element ≤ Haufengröße).
   * Für 0-Stein-Haufen → 0.
   */
  Game.maxAllowable = function (heapIdx) {
    const s = Game.state;
    if (typeof heapIdx !== "number" || heapIdx < 0 || heapIdx >= s.heaps.length) {
      return 0;
    }
    const size = s.heaps[heapIdx];
    if (size < 1) {
      return 0;
    }
    if (s.allowed === null || s.allowed === undefined) {
      return size;
    }
    let best = 0;
    for (let i = 0; i < s.allowed.length; i++) {
      if (s.allowed[i] <= size && s.allowed[i] > best) {
        best = s.allowed[i];
      }
    }
    return best > 0 ? best : 1;
  };

  /**
   * Game.selectHeap(idx) → wählt den Ziel-Haufen aus (Task 10).
   */
  Game.selectHeap = function (idx) {
    if (Game.isLocked()) {
      return;
    }
    const s = Game.state;
    if (typeof idx !== "number" || !Number.isInteger(idx)) {
      return;
    }
    if (idx < 0 || idx >= s.heaps.length) {
      return;
    }
    if (s.heaps[idx] < 1) {
      return;
    }
    s.selectedHeap = idx;
    Game.renderSelection();
    Game.updateButtonState();
  };

  /**
   * Game.renderSelection() → spiegelt selectedHeap als "selected"-Klasse
   * und aria-pressed-Attribut.
   */
  Game.renderSelection = function () {
    const s = Game.state;
    const heaps = document.querySelectorAll("#heaps .heap");
    heaps.forEach(function (el) {
      const i = parseInt(el.dataset.heapIndex, 10);
      const empty = el.classList.contains("heap--empty");
      const selected = i === s.selectedHeap && !empty;
      el.classList.toggle("selected", selected);
      if (empty) {
        el.removeAttribute("aria-pressed");
      } else {
        el.setAttribute("aria-pressed", selected ? "true" : "false");
      }
    });
  };

  /**
   * Game.readAmount() → Zahl | null
   */
  Game.readAmount = function () {
    const el = document.querySelector("#amount-input");
    if (!el) {
      return null;
    }
    const raw = el.value.trim();
    if (raw === "" || !/^\d+$/.test(raw)) {
      return null;
    }
    const n = parseInt(raw, 10);
    return n >= 1 ? n : null;
  };

  /**
   * Game.validateInput() → boolean (Task 10).
   */
  Game.validateInput = function () {
    const s = Game.state;
    if (s.selectedHeap < 0 || s.selectedHeap >= s.heaps.length) {
      return false;
    }
    const amount = Game.readAmount();
    if (amount === null) {
      return false;
    }
    const heapSize = s.heaps[s.selectedHeap];
    return window.Nim.legalAmount(s.rule, s.allowed, amount, heapSize);
  };

  /**
   * Game.updateButtonState() → zentrales Enable/Disable + Fehlermeldung,
   * zusätzlich +/– Knöpfe, Menge-Vorschau und Rückgängig.
   */
  Game.updateButtonState = function () {
    const btn = document.querySelector("#draw-btn");
    const input = document.querySelector("#amount-input");
    const err = document.querySelector("#input-error");
    const locked = Game.isLocked();
    const valid = !locked && Game.validateInput();
    const value = input ? String(input.value).trim() : "";
    const hasInput = value !== "";

    if (btn) {
      btn.disabled = !valid;
      Game._setAriaDisabled(btn, !valid);
    }

    const minusBtn = document.querySelector("#minus-btn");
    const plusBtn = document.querySelector("#plus-btn");
    const s = Game.state;
    const canBump = !locked &&
      s.selectedHeap >= 0 &&
      s.selectedHeap < s.heaps.length &&
      s.heaps[s.selectedHeap] >= 1;
    if (minusBtn) {
      minusBtn.disabled = !canBump;
      Game._setAriaDisabled(minusBtn, !canBump);
    }
    if (plusBtn) {
      plusBtn.disabled = !canBump;
      Game._setAriaDisabled(plusBtn, !canBump);
    }

    if (err) {
      let msg = "";
      if (!locked && hasInput && !valid) {
        const amount = Game.readAmount();
        if (s.selectedHeap >= 0 && s.selectedHeap < s.heaps.length && amount !== null) {
          const maxTake = Game.maxAllowable(s.selectedHeap);
          const minAllowed = (s.allowed && s.allowed.length) ? s.allowed[0] : 1;
          if (amount > maxTake || amount < 1) {
            msg = "Nur 1 bis " + maxTake + " Rosinen aus diesem Haufen.";
          } else {
            msg = "Nicht gültig für den gewählten Haufen.";
          }
        } else {
          msg = "Nicht gültig für den gewählten Haufen.";
        }
      }
      err.textContent = msg;
      err.hidden = msg === "";
    }

    Game.renderUndoButton();
  };

  /**
   * Game.snapAmount(amount) → Menge | null. Im Listen-Modus (Eigene Liste)
   * klemmt die Menge auf die nächstliegende erlaubte Menge (größte ≤ amount,
   * sonst kleinste erlaubte). Klassisch: unverändert (mit ≤ Haufengröße).
   */
  Game.snapAmount = function (amount) {
    const s = Game.state;
    if (amount < 1) {
      return null;
    }
    if (s.selectedHeap < 0 || s.selectedHeap >= s.heaps.length) {
      return null;
    }
    const heapSize = s.heaps[s.selectedHeap];
    if (s.allowed && s.allowed.length) {
      const legal = s.allowed.filter(function (a) { return a <= heapSize; });
      if (!legal.length) {
        return null;
      }
      let best = null;
      for (let i = 0; i < legal.length; i++) {
        if (legal[i] <= amount) {
          best = legal[i];
        }
      }
      return best !== null ? best : legal[0];
    }
    // Klassisch: 1..Haufengröße alles erlaubt.
    if (amount > heapSize) {
      return heapSize >= 1 ? heapSize : null;
    }
    return amount;
  };

  /**
   * Game.previewAmount(heapIdx, amount) → setzt Input + Vorschau + markiert
   * die obersten `amount` Steine dieses Haufens mit ✓-Markierung.
   * Ungültige Mengen (Listen-Modus) werden auf die nächste erlaubte geklemmt.
   */
  Game.previewAmount = function (heapIdx, amount) {
    const s = Game.state;
    const input = document.querySelector("#amount-input");
    const preview = document.querySelector("#amount-preview");
    const heapsEl = document.querySelector("#heaps");

    // Menge unklar/0 → nur Markierung zurücksetzen, Eingabe nicht anfassen
    // (sonst würde ein geleertes Feld auf "0" zurückspringen).
    if (amount < 1) {
      if (preview) {
        preview.textContent = "–";
      }
      if (heapsEl) {
        heapsEl.querySelectorAll(".stone").forEach(function (st) {
          st.classList.remove("marked");
        });
      }
      if (typeof Game.updateButtonState === "function") {
        Game.updateButtonState();
      }
      return;
    }

    // Auf erlaubte Mengen klemmen (Listen-Modus) – z. B. 2 → 3 bei [1,3,5].
    amount = Game.snapAmount(amount);
    if (amount === null) {
      if (preview) {
        preview.textContent = "–";
      }
      if (heapsEl) {
        heapsEl.querySelectorAll(".stone").forEach(function (st) {
          st.classList.remove("marked");
        });
      }
      if (typeof Game.updateButtonState === "function") {
        Game.updateButtonState();
      }
      return;
    }

    if (input) {
      input.value = String(amount);
    }
    if (preview) {
      preview.textContent = amount;
    }
    if (heapsEl) {
      heapsEl.querySelectorAll(".stone").forEach(function (st) {
        st.classList.remove("marked");
      });
      const heapEl = document.querySelector('#heaps .heap[data-heap-index="' + heapIdx + '"]');
      if (heapEl) {
        const stones = heapEl.querySelectorAll(".stone");
        Array.prototype.slice.call(stones, Math.max(0, stones.length - amount))
          .forEach(function (st) {
            st.classList.add("marked");
          });
      }
    }
    Game.updateButtonState();
  };

  /**
   * Game.bumpAmount(delta) → +/- eine Rosine auf der Menge (mit Clamp).
   * Im Listen-Modus ("Eigene Liste") geht es nur zwischen erlaubten
   * Mengen (z. B. 1 → 3 → 5), nie zu illegalen Werten wie 2 oder 4.
   */
  Game.bumpAmount = function (delta) {
    if (Game.isLocked()) {
      return;
    }
    const s = Game.state;
    const input = document.querySelector("#amount-input");
    if (!input) {
      return;
    }
    if (s.selectedHeap < 0 || s.selectedHeap >= s.heaps.length) {
      return;
    }
    const heapSize = s.heaps[s.selectedHeap];
    const maxTake = Game.maxAllowable(s.selectedHeap);
    let cur = Game.readAmount();
    if (cur === null) {
      cur = 1;
    }

    let next;
    if (s.allowed && s.allowed.length) {
      // Nur erlaubte Mengen verwenden: nächste/vorherige im Listen-Modus.
      const allowed = s.allowed.filter(function (a) { return a <= heapSize; });
      if (delta >= 0) {
        next = allowed.length ? allowed[0] : 1;
        for (let i = 0; i < allowed.length; i++) {
          if (allowed[i] > cur) {
            next = allowed[i];
            break;
          }
        }
      } else {
        next = 1;
        for (let i = 0; i < allowed.length; i++) {
          if (allowed[i] < cur) {
            next = allowed[i];
          }
        }
      }
    } else {
      next = cur + delta;
      if (next < 1) {
        next = 1;
      }
      if (next > maxTake) {
        next = maxTake;
      }
    }

    input.value = String(next);
    Game.previewAmount(s.selectedHeap, next);
  };

  /**
   * Game.animateAndRemove(heapIdx, amount, cb) (Task 11) – wie vor,
   * ohne Änderung der öffentlichen Semantik.
   */
  Game.animateAndRemove = function (heapIdx, amount, cb) {
    const s = Game.state;
    const heapSize = s.heaps[heapIdx];
    if (heapSize == null || amount == null || amount < 1 || amount > heapSize) {
      if (typeof cb === "function") { cb(); }
      return;
    }

    s.lock = true;
    Game.updateButtonState();
    const input = document.querySelector("#amount-input");
    if (input) { input.disabled = true; }

    const heapEl = document.querySelector(
      '#heaps .heap[data-heap-index="' + heapIdx + '"]'
    );
    if (!heapEl) {
      s.lock = false;
      if (input) { input.disabled = false; }
      Game.updateButtonState();
      if (typeof cb === "function") { cb(); }
      return;
    }
    const stones = heapEl.querySelectorAll(".stone");
    const targets = Array.prototype.slice.call(stones).slice(-amount);
    targets.forEach(function (el) {
      el.classList.add("blinking");
      el.classList.remove("marked");
    });

    let done = false;
    const seq = Game._moveSeq;
    function finalize() {
      if (done) { return; }
      done = true;
      if (seq === Game._moveSeq && Game._animTimer !== undefined) {
        clearTimeout(Game._animTimer);
        Game._animTimer = undefined;
      }
      if (seq !== Game._moveSeq) { return; }

      targets.forEach(function (el) { el.remove(); });
      heapEl.querySelectorAll(".stone.blinking")
        .forEach(function (el) { el.classList.remove("blinking"); });

      s.heaps[heapIdx] = s.heaps[heapIdx] - amount;

      s.lock = false;
      const inp = document.querySelector("#amount-input");
      if (inp) { inp.disabled = false; }
      Game.updateButtonState();

      Game.render();
      if (typeof cb === "function") { cb(); }
    }

    const reducedMotion = typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      finalize();
      return;
    }

    if (targets.length) {
      targets[0].addEventListener("animationend", finalize, { once: true });
    }
    Game._animTimer = setTimeout(function () {
      Game._animTimer = undefined;
      finalize();
    }, 1300);
  };

  /**
   * Game.pushHistory() → speichert einen Snapshot VOR dem Zug (für Undo).
   */
  Game.pushHistory = function () {
    const s = Game.state;
    s.undoStack = s.undoStack || [];
    s.undoStack.push({
      heaps: s.heaps.slice(),
      active: s.active,
      lastMove: s.lastMove ? { player: s.lastMove.player, heapIdx: s.lastMove.heapIdx, amount: s.lastMove.amount } : null,
      selectedHeap: s.selectedHeap
    });
    if (s.undoStack.length > 200) {
      s.undoStack.shift();
    }
  };

  /**
   * Game.executeMove() → void
   * Handler des Buttons „Nimm!" (und des Drag-Commits).
   */
  Game.executeMove = function () {
    if (Game.isLocked()) {
      return;
    }
    if (!Game.validateInput()) {
      return;
    }

    const s = Game.state;
    const heapIdx = s.selectedHeap;
    const amount = Game.readAmount();

    Game.pushHistory();
    Game.animateAndRemove(heapIdx, amount, function () {
      s.lastMove = { player: s.active, heapIdx: heapIdx, amount: amount };
      s.active = (s.active === 1) ? 2 : 1;

      s.selectedHeap = -1;
      const input = document.querySelector("#amount-input");
      if (input) { input.value = ""; }
      const err = document.querySelector("#input-error");
      if (err) {
        err.hidden = true;
        err.textContent = "";
      }
      if (s.heaps.length === 1) {
        s.selectedHeap = 0;
      }

      Game.render();
      Game.checkWin();
      Game.maybeAIMove();
    });
  };

  /**
   * Game.checkWin() → void
   * Wenn die Summe aller Haufen 0 ist, zeige das Win-Overlay.
   */
  Game.checkWin = function () {
    const s = Game.state;
    let total = 0;
    for (let i = 0; i < s.heaps.length; i++) {
      total += s.heaps[i];
    }
    if (total !== 0) {
      return;
    }
    const winnerPlayer = s.lastMove ? s.lastMove.player : s.active;
    const winnerName = (winnerPlayer === 1) ? s.name1 : s.name2;
    Game.onGameEnd(winnerPlayer);
    Game.showWinOverlay(winnerName);
    Game.renderUndoButton();
  };

  /**
   * Game.onGameEnd(winnerPlayer) → setzt Gesichter/Sprechblasen je nach
   * Ausgang (KI verliert = wütend, KI gewinnt = genervt, Mensch gewinnt = Feier).
   */
  Game.onGameEnd = function (winnerPlayer) {
    const s = Game.state;
    s.bubble = {};
    s.faces = Game.idleFaces();
    if (winnerPlayer === 1) {
      s.faces[1] = "🥳";
      s.faces[2] = Game.isAI(s.opponent) ? "😠" : "😅";
      if (Game.isAI(s.opponent)) {
        s.bubble[2] = randomInList(AI_LOSE_LINES);
      } else {
        s.bubble[1] = randomInList(HUMAN_WIN_LINES);
      }
    } else {
      s.faces[2] = Game.isAI(s.opponent) ? "😤" : "🥳";
      s.faces[1] = "😅";
      if (Game.isAI(s.opponent)) {
        s.bubble[2] = randomInList(AI_WIN_LINES);
      } else {
        s.bubble[2] = "YAY! 🥳";
      }
    }
    Game.renderCharacters();
  };

  /**
   * Game.showWinOverlay(winnerName) → void
   * Zeigt #win-overlay mit Sieger-Gesicht, Glückwunsch und Buttons.
   */
  Game.showWinOverlay = function (winnerName) {
    const overlay = document.querySelector("#win-overlay");
    if (!overlay) {
      return;
    }
    Game._winLastFocused = document.activeElement;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "win-title");
    overlay.innerHTML = "";

    const face = document.createElement("div");
    face.className = "win-face";
    face.textContent = "🥳";
    overlay.appendChild(face);

    const msg = document.createElement("p");
    msg.id = "win-title";
    msg.className = "win-message";
    msg.textContent = winnerName + " hat gewonnen!";
    overlay.appendChild(msg);

    const sub = document.createElement("p");
    sub.className = "win-sub";
    sub.textContent = "Alle Rosinen sind weg! 🍇";
    overlay.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "overlay-actions";

    const btn = document.createElement("button");
    btn.id = "new-game-btn";
    btn.type = "button";
    btn.textContent = "Neues Spiel";
    btn.addEventListener("click", function () {
      Game.newGame();
    });
    actions.appendChild(btn);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "win-secondary";
    closeBtn.textContent = "Zurück zum Spiel";
    closeBtn.addEventListener("click", function () {
      overlay.hidden = true;
      const target = Game._winLastFocused;
      if (target && typeof target.focus === "function") {
        target.focus();
      }
      Game._winLastFocused = null;
    });
    actions.appendChild(closeBtn);

    const optBtn = document.createElement("button");
    optBtn.type = "button";
    optBtn.className = "win-secondary";
    optBtn.textContent = "Optionen öffnen";
    optBtn.addEventListener("click", function () {
      overlay.hidden = true;
      Game.openOptions();
    });
    actions.appendChild(optBtn);

    overlay.appendChild(actions);
    overlay.hidden = false;
    if (typeof btn.focus === "function") {
      btn.focus();
    }
    Game.confetti();
  };

  /**
   * Game.confetti() → kleine Konfettischau (DOM-only, keine Assets).
   */
  Game.confetti = function () {
    if (typeof document === "undefined") {
      return;
    }
    const layer = document.querySelector("#confetti-layer");
    if (!layer) {
      return;
    }
    const colors = ["#f5b301", "#e85d04", "#2f9e44", "#3f7fd1", "#d6336c", "#845ef7"];
    for (let i = 0; i < 60; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti";
      piece.style.left = (Math.random() * 100) + "vw";
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = (Math.random() * 0.8) + "s";
      piece.style.animationDuration = (2 + Math.random() * 2) + "s";
      piece.style.transform = "rotate(" + Math.floor(Math.random() * 360) + "deg)";
      layer.appendChild(piece);
      (function (el) {
        setTimeout(function () { el.remove(); }, 5200);
      })(piece);
    }
  };

  /**
   * Game.newGame() → void
   * Handler des Buttons „Neues Spiel" (und „Neue Runde"):
   * - Win-Overlay ausblenden, Gesichte/Bubbles/Undo-Stack zurücksetzen,
   * - Spiel mit DEN aktuellen Parametern neu starten.
   */
  Game.newGame = function () {
    const overlay = document.querySelector("#win-overlay");
    if (overlay) {
      overlay.hidden = true;
    }
    const input = document.querySelector("#amount-input");
    if (input) {
      input.value = "";
    }
    Game.clearBubbles();
    Game.state.undoStack = [];
    Game.state.faces = null;
    Game.start();
  };

  // --- Rückgängig (Undo) -------------------------------------------------------

  /**
   * Game.undoStack() → der aktuelle Zug-Stapel (Array).
   */
  Game.undoStack = function () {
    return Game.state.undoStack || [];
  };

  /**
   * Game.renderUndoButton() → aktiviert #undo-btn je nach undoEnabled +
   * Stapel-Inhalt. Der Lock wird NICHt geprüft: der Undo soll auch im
   * KI-Reaktionsfenster ("denkt…") wirken, damit eine Ärgerin sofort nach
   * einem unglücklichen Zug zurücknehmen kann (undoMove bricht den Job ab).
   */
  Game.renderUndoButton = function () {
    const btn = document.querySelector("#undo-btn");
    if (!btn) {
      return;
    }
    const s = Game.state;
    const avail = s.undoEnabled === true && Game.undoStack().length > 0;
    btn.disabled = !avail;
    Game._setAriaDisabled(btn, !avail);
  };

  /**
   * Game.undoMove() → setzt den letzten (bei KI: letzten Menschen) Zug zurück:
   *   - KI-Gegenspieler: wir popen Snapshots, bis der aktive Spieler wieder
   *     der Mensch ist (das ist die Position VOR dem letzten Menschenzug).
   *   - Mensch-gg-Mensch: einfach der oberste Snapshot (letzter Zug).
   */
  Game.undoMove = function () {
    const s = Game.state;
    if (s.undoEnabled !== true) {
      return;
    }
    const stack = s.undoStack;
    if (!stack || stack.length === 0) {
      return;
    }
    const isAIGame = Game.isAI(s.opponent);

    // Ausstehende Animationen/KI-Jobs aus dem alten Zug invalidieren:
    // Generation hochzählen, damit kein verspäteter finalize mehr subtrahiert,
    // dann Timer aufräumen und Lock lösen.
    Game._moveSeq = (Game._moveSeq || 0) + 1;
    // Auch während eines laufenden KI-Jobs (Lock) erlaubt: der ausstehende
    // KI-Timer wird abgebrochen, sodass der Undo sofort wirkt.
    Game.cancelAIMove();

    // Ziel-Snapshot suchen: bei KI-Gegenspieler der letzte MENSCH-Zug (active=1);
    // bei Mensch-gg-Mensch einfach der oberste. Alles NÄHER an der Oberfläche
    // (KI-Antworten) wird mitgerollt; bei KI-Start ohne Menschenzug: kein Undo.
    let idxToRestore = -1;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (!isAIGame || stack[i].active === 1) {
        idxToRestore = i;
        break;
      }
    }
    if (idxToRestore === -1) {
      return;
    }
    const snap = stack[idxToRestore];
    stack.length = idxToRestore;

    Game.cancelAIMove();
    s.heaps = snap.heaps;
    s.active = snap.active;
    s.lastMove = snap.lastMove;
    s.selectedHeap = s.heaps.length === 1 ? 0 : -1;
    s.bubble = {};
    s.faces = Game.idleFaces();

    // Freundlicher Hinweis an den Spieler, dessen Zug zurückgesetzt wurde.
    const player = snap.active;
    s.bubble[player] = randomInList(UNDO_HINT_LINES);

    const input = document.querySelector("#amount-input");
    if (input) {
      input.value = "";
    }
    const err = document.querySelector("#input-error");
    if (err) {
      err.hidden = true;
      err.textContent = "";
    }

    const overlay = document.querySelector("#win-overlay");
    if (overlay) {
      overlay.hidden = true;
    }

    Game.render();
    Game.renderUndoButton();
    Game.renderCharacters();
    Game.maybeAIMove();
  };

  // --- Options-Dialog ----------------------------------------------------------

  Game.optionsOpen = function () {
    const dlg = document.querySelector("#options-dialog");
    return !!(dlg && !dlg.hidden);
  };

  /**
   * Game.clearOptionErrors() → void
   */
  Game.clearOptionErrors = function () {
    ["opt-max-heaps", "opt-own-list", "opt-max-stones", "opt-min-stones"].forEach(function (id) {
      const el = document.querySelector("#" + id);
      if (el) {
        el.removeAttribute("aria-invalid");
      }
    });
    const err = document.querySelector("#opt-error");
    if (err) {
      err.textContent = "";
      err.hidden = true;
    }
  };

  Game.showOptionError = function (msg, fieldId) {
    const err = document.querySelector("#opt-error");
    if (err) {
      err.textContent = msg;
      err.hidden = false;
    }
    if (fieldId) {
      const el = document.querySelector("#" + fieldId);
      if (el) {
        el.setAttribute("aria-invalid", "true");
      }
    }
    const applyBtn = document.querySelector("#opt-apply");
    if (applyBtn) {
      applyBtn.disabled = true;
      Game._setAriaDisabled(applyBtn, true);
    }
  };

  Game.readOptionInt = function (fieldId) {
    const el = document.querySelector("#" + fieldId);
    if (!el) {
      return null;
    }
    const raw = el.value.trim();
    if (!/^\d+$/.test(raw)) {
      return null;
    }
    return parseInt(raw, 10);
  };

  Game.selectedRule = function () {
    const el = document.querySelector('input[name="opt-rule"]:checked');
    return el ? el.value : "4er";
  };

  Game.selectedOpponent = function () {
    const el = document.querySelector('input[name="opt-opponent"]:checked');
    return el ? el.value : "Mensch";
  };

  Game.selectedStart = function () {
    const el = document.querySelector('input[name="opt-start"]:checked');
    return el ? el.value : "random";
  };

  Game.toggleOwnList = function () {
    const isOwn = Game.selectedRule() === "own";
    const wrap = document.querySelector("#opt-own-wrap");
    const input = document.querySelector("#opt-own-list");
    if (wrap) {
      wrap.hidden = !isOwn;
    }
    if (input) {
      input.disabled = !isOwn;
    }
  };

  Game.fillOptions = function () {
    const s = Game.state;
    const set = function (id, val) {
      const el = document.querySelector("#" + id);
      if (el) {
        el.value = val;
      }
    };
    set("opt-max-heaps", s.maxHaufen);
    set("opt-max-stones", s.maxSteine);
    set("opt-min-stones", s.minSteine);
    set("opt-name1", s.name1);
    set("opt-name2", s.name2);

    const ruleEl = document.querySelector(
      'input[name="opt-rule"][value="' + s.rule + '"]'
    );
    if (ruleEl) {
      ruleEl.checked = true;
    }
    Game.toggleOwnList();

    const ownInput = document.querySelector("#opt-own-list");
    if (ownInput) {
      ownInput.value = (s.rule === "own" && s.ownList) ? s.ownList : "";
    }

    const oppEl = document.querySelector(
      'input[name="opt-opponent"][value="' + s.opponent + '"]'
    );
    if (oppEl) {
      oppEl.checked = true;
    }

    const startEl = document.querySelector(
      'input[name="opt-start"][value="' + s.startPlayer + '"]'
    );
    if (startEl) {
      startEl.checked = true;
    }

    const undoEl = document.querySelector("#opt-undo");
    if (undoEl) {
      undoEl.checked = s.undoEnabled === true;
    }
  };

  Game._setAriaDisabled = function (btn, disabled) {
    if (btn) {
      btn.setAttribute("aria-disabled", disabled ? "true" : "false");
    }
  };

  Game._getFocusableOptions = function (dlg) {
    let els;
    try {
      els = Array.prototype.slice.call(dlg.querySelectorAll(":focusable"));
    } catch (e) {
      els = Array.prototype.slice.call(dlg.querySelectorAll(
        'button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'
      ));
    }
    return els.filter(function (el) {
      return !el.disabled && el.offsetParent !== null;
    });
  };

  Game.openOptions = function () {
    const dlg = document.querySelector("#options-dialog");
    if (!dlg) {
      return;
    }
    Game._optionsLastFocused = document.activeElement;
    Game.clearOptionErrors();
    Game.fillOptions();
    dlg.hidden = false;
    const applyBtn = document.querySelector("#opt-apply");
    if (applyBtn) {
      applyBtn.disabled = false;
      Game._setAriaDisabled(applyBtn, false);
    }
    const first = document.querySelector("#opt-max-heaps");
    if (first) {
      first.focus();
    }
  };

  Game.closeOptions = function () {
    const dlg = document.querySelector("#options-dialog");
    if (dlg) {
      dlg.hidden = true;
    }
    const target = Game._optionsLastFocused;
    if (target && typeof target.focus === "function" && document.contains(target)) {
      target.focus();
    } else {
      const gear = document.querySelector("#options-btn");
      if (gear) { gear.focus(); }
    }
    Game._optionsLastFocused = null;
  };

  Game._trapDialogFocus = function (ev) {
    if (ev.key === "Escape") {
      ev.preventDefault();
      Game.closeOptions();
      return;
    }
    if (ev.key !== "Tab") {
      return;
    }
    const dlg = document.querySelector("#options-dialog");
    if (!dlg || dlg.hidden) {
      return;
    }
    const focusable = Game._getFocusableOptions(dlg);
    if (!focusable.length) {
      ev.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (ev.shiftKey) {
      if (active === first || !dlg.contains(active)) {
        ev.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !dlg.contains(active)) {
        ev.preventDefault();
        first.focus();
      }
    }
  };

  Game.validateOptions = function () {
    Game.clearOptionErrors();

    const maxHaufen = Game.readOptionInt("opt-max-heaps");
    const maxSteine = Game.readOptionInt("opt-max-stones");
    const minSteine = Game.readOptionInt("opt-min-stones");

    if (maxHaufen === null || maxHaufen < 1) {
      Game.showOptionError("Maximale Haufenzahl muss mindestens 1 sein.", "opt-max-heaps");
      return false;
    }
    if (maxSteine === null || maxSteine < 1) {
      Game.showOptionError("Maximale Steine pro Haufen müssen mindestens 1 sein.", "opt-max-stones");
      return false;
    }
    if (minSteine === null || minSteine < 0) {
      Game.showOptionError("Minimale Steine pro Haufen müssen mindestens 0 sein.", "opt-min-stones");
      return false;
    }
    if (minSteine > maxSteine) {
      Game.showOptionError("Minimale Steine dürfen nicht mehr als maximale sein.", "opt-min-stones");
      return false;
    }

    const rule = Game.selectedRule();
    if (rule === "own") {
      const ownList = (document.querySelector("#opt-own-list") || {}).value || "";
      if (window.Nim.parseAllowed("own", ownList) === null) {
        Game.showOptionError("Eigene Liste: positive Ganzzahlen, die Zahl 1 muss enthalten sein.", "opt-own-list");
        return false;
      }
    }

    const applyBtn = document.querySelector("#opt-apply");
    if (applyBtn) {
      applyBtn.disabled = false;
      Game._setAriaDisabled(applyBtn, false);
    }
    return true;
  };

  Game.prefillAIName = function () {
    const opp = Game.selectedOpponent();
    if (Game.isAI(opp)) {
      const el = document.querySelector("#opt-name2");
      if (el) {
        el.value = opp;
      }
    }
  };

  Game.applyOptions = function () {
    if (!Game.validateOptions()) {
      return;
    }

    const s = Game.state;
    const rule = Game.selectedRule();

    s.maxHaufen = Game.readOptionInt("opt-max-heaps");
    s.maxSteine = Game.readOptionInt("opt-max-stones");
    s.minSteine = Game.readOptionInt("opt-min-stones");
    s.rule = rule;
    s.ownList = (rule === "own") ? ((document.querySelector("#opt-own-list") || {}).value || "") : undefined;
    s.opponent = Game.selectedOpponent();
    s.startPlayer = Game.selectedStart();
    s.undoEnabled = ((document.querySelector("#opt-undo") || {}).checked) === true;

    const name1 = (document.querySelector("#opt-name1") || {}).value;
    const name2 = (document.querySelector("#opt-name2") || {}).value;
    s.name1 = (name1 && name1.trim()) ? name1.trim() : "Spieler 1";
    s.name2 = (name2 && name2.trim()) ? name2.trim() : "Spieler 2";

    s.allowed = window.Nim.parseAllowed(s.rule, s.ownList);

    const overlay = document.querySelector("#win-overlay");
    if (overlay) {
      overlay.hidden = true;
    }

    Game.closeOptions();
    Game.start();
  };

  // --- Event-Anbindung ---------------------------------------------------------

  /**
   * Game.bindEvents() → bindet Klick/Tastatur auf .heap, +/–, Undo, Round,
   * Drag-Auswahl und Options-Dialog.
   */
  Game.bindEvents = function () {
    if (Game._eventsBound) {
      return;
    }
    Game._eventsBound = true;

    const heapsEl = document.querySelector("#heaps");

    // Haufen: Auswahl per Klick (delegiert).
    if (heapsEl) {
      heapsEl.addEventListener("click", function (ev) {
        const heap = ev.target.closest(".heap");
        if (!heap) {
          return;
        }
        Game.selectHeap(parseInt(heap.dataset.heapIndex, 10));
      });

      // Haufen: Tastatur (Enter/Leer) wählt den fokussierten Haufen aus.
      heapsEl.addEventListener("keydown", function (ev) {
        if (ev.key !== "Enter" && ev.key !== " ") {
          return;
        }
        const heap = ev.target.closest(".heap");
        if (!heap) {
          return;
        }
        ev.preventDefault();
        Game.selectHeap(parseInt(heap.dataset.heapIndex, 10));
      });

      // ===== Drag-Auswahl: Finger/Zeiger auf einen Stein legen, über mehrere
      // Steine ziehen, loslassen = Zug. (Klick bleibt = Auswahl/Bestätigung.)
      if (typeof window.PointerEvent !== "undefined") {
        Game.bindDrag(heapsEl, "pointerdown", "pointermove", "pointerup", "pointercancel");
      } else if (typeof window.MouseEvent !== "undefined") {
        Game.bindDrag(heapsEl, "mousedown", "mousemove", "mouseup", null);
      }
    }

    // Input: reaktive Validierung bei jeder Änderung.
    const input = document.querySelector("#amount-input");
    if (input) {
      input.disabled = false;
      input.addEventListener("input", function () {
        if (Game.isLocked()) { return; }
        Game.updateButtonState();
        Game.previewAmount(Game.state.selectedHeap, Game.readAmount() || 0);
      });
      input.addEventListener("change", function () {
        if (Game.isLocked()) { return; }
        Game.updateButtonState();
      });
    }

    // Button „Nimm!" (Task 12): executeMove mit Lock-Guard.
    const drawBtn = document.querySelector("#draw-btn");
    if (drawBtn) {
      drawBtn.addEventListener("click", function () {
        if (Game.isLocked()) { return; }
        Game.executeMove();
      });
    }

    // +/- Knöpfe.
    const minusBtn = document.querySelector("#minus-btn");
    if (minusBtn) {
      minusBtn.addEventListener("click", function () { Game.bumpAmount(-1); });
    }
    const plusBtn = document.querySelector("#plus-btn");
    if (plusBtn) {
      plusBtn.addEventListener("click", function () { Game.bumpAmount(1); });
    }

    // Rückgängig-Button.
    const undoBtn = document.querySelector("#undo-btn");
    if (undoBtn) {
      undoBtn.addEventListener("click", function () { Game.undoMove(); });
    }

    // Neue Runde.
    const newRoundBtn = document.querySelector("#new-round-btn");
    if (newRoundBtn) {
      newRoundBtn.addEventListener("click", function () { Game.newGame(); });
    }

    // --- Options-Dialog (Task 13) ---
    const optBtn = document.querySelector("#options-btn");
    if (optBtn) {
      optBtn.addEventListener("click", function () {
        if (Game.optionsOpen()) {
          Game.closeOptions();
        } else {
          Game.openOptions();
        }
      });
    }

    document.addEventListener("keydown", function (ev) {
      if (!Game.optionsOpen()) {
        return;
      }
      Game._trapDialogFocus(ev);
    });

    const cancelBtn = document.querySelector("#opt-cancel");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () {
        Game.closeOptions();
      });
    }

    const applyBtn = document.querySelector("#opt-apply");
    if (applyBtn) {
      applyBtn.addEventListener("click", function () {
        Game.applyOptions();
      });
    }

    const dlg = document.querySelector("#options-dialog");
    if (dlg) {
      dlg.addEventListener("change", function (ev) {
        const t = ev.target;
        if (!t) {
          return;
        }
        if (t.name === "opt-rule") {
          Game.toggleOwnList();
        }
        if (t.name === "opt-opponent") {
          Game.prefillAIName();
        }
        if (t.closest && t.closest("#options-dialog")) {
          Game.validateOptions();
        }
      });

      dlg.addEventListener("input", function (ev) {
        const t = ev.target;
        if (!t) {
          return;
        }
        if (["opt-max-heaps", "opt-max-stones", "opt-min-stones", "opt-own-list"].indexOf(t.id) !== -1) {
          Game.validateOptions();
        }
      });
    }
  };

  /**
   * Game.bindDrag(heapsEl, downEv, moveEv, upEv, cancelEv) → Drag-Interaktion
   * auf den Steinen: Finger/Zeiger auf einen Stein, über die anderen ziehen,
   * loslassen → Menge wird ausgemacht und sofort gezogen.
   *   - travel < 12 px  → nur Auswahl (kein Zug), Kind nutzt Nimm/+/-
   *   - travel ≥ 12 px  → loslassen = Zug (Menge = gezogene Anzahl)
   */
  Game.bindDrag = function (heapsEl, downEv, moveEv, upEv, cancelEv) {
    let drag = null;

    function pointOf(ev) {
      return {
        x: (typeof ev.clientX === "number") ? ev.clientX : 0,
        y: (typeof ev.clientY === "number") ? ev.clientY : 0
      };
    }

    function heapFrom(ev) {
      if (!ev.target || typeof ev.target.closest !== "function") {
        return null;
      }
      return ev.target.closest(".heap");
    }

    function stoneIndexIn(heapEl, stoneEl) {
      const list = heapEl.querySelectorAll(".stone");
      return Array.prototype.indexOf.call(list, stoneEl);
    }

    const onDown = function (ev) {
      if (Game.isLocked()) {
        return;
      }
      const s = Game.state;
      const heap = heapFrom(ev);
      if (!heap) {
        return;
      }
      const idx = parseInt(heap.dataset.heapIndex, 10);
      if (typeof idx !== "number" || idx < 0 || idx >= s.heaps.length) {
        return;
      }
      if (s.heaps[idx] < 1) {
        return;
      }
      const stone = (ev.target && typeof ev.target.closest === "function")
        ? ev.target.closest(".stone") : null;
      if (!stone) {
        return;
      }
      if (ev.preventDefault) {
        ev.preventDefault();
      }
      Game.selectHeap(idx);

      const pos = stoneIndexIn(heap, stone);
      const list = heap.querySelectorAll(".stone");
      const n = Math.max(1, list.length - pos);
      const p0 = pointOf(ev);
      // Der Haufen, auf dem der Zug begonnen wurde, bleibt fest. Ein
      // versehentliches Überqueren eines anderen Haufens darf niemals den
      // Zielhaufen wechseln; Loslassen außerhalb des Haufens soll trotzdem
      // den begonnenen Zug abschließen.
      drag = { originIdx: idx, n: n, p0: p0, committed: false };
      Game.previewAmount(idx, n);
    };

    const onMove = function (ev) {
      if (!drag || drag.committed) {
        return;
      }
      if (ev.preventDefault) {
        ev.preventDefault();
      }
      // Nur Steine des Ursprungshaufens verändern die Auswahl. Außerhalb
      // eines Haufens oder über einem anderen Haufen bleibt der laufende Zug
      // gültig und behält seine bisherige Menge.
      const originHeap = document.querySelector(
        '#heaps .heap[data-heap-index="' + drag.originIdx + '"]'
      );
      const heap = heapFrom(ev);
      if (!heap || heap !== originHeap) {
        return;
      }
      const stone = (ev.target && typeof ev.target.closest === "function")
        ? ev.target.closest(".stone") : null;
      if (stone) {
        const list = heap.querySelectorAll(".stone");
        const pos = Array.prototype.indexOf.call(list, stone);
        if (pos !== -1) {
          drag.n = Math.max(1, list.length - pos);
        }
      }
      Game.previewAmount(drag.originIdx, drag.n);
    };

    const onUp = function (ev) {
      if (!drag || drag.committed) {
        return;
      }
      const p1 = pointOf(ev);
      const travel = Math.abs(p1.x - drag.p0.x) + Math.abs(p1.y - drag.p0.y);
      const current = drag;
      drag = null;
      if (travel < 12) {
        // Nur Auswahl – kein Zug, Kind kann Nimm/+/- oder weiterziehen.
        return;
      }
      const idx = current.originIdx;
      const stillOk = idx >= 0 && idx < Game.state.heaps.length &&
        Game.state.heaps[idx] >= 1;
      if (!stillOk) {
        return;
      }
      // Der Zug wird auf dem Ursprungshaufen abgeschlossen, egal, wo der
      // Zeiger losgelassen wurde (auch außerhalb der Haufen).
      // Auf erlaubte Mengen klemmen (Listen-Modus), damit auch Drag-Züge
      // mit z. B. 2 Steinchen bei [1,3,5] legal bleiben (→ 3).
      let amount = Math.min(current.n, Game.maxAllowable(idx));
      amount = (amount >= 1) ? Game.snapAmount(amount) : null;
      if (amount === null || amount < 1) {
        return;
      }
      const input = document.querySelector("#amount-input");
      if (input) {
        input.value = String(amount);
      }
      Game.selectHeap(idx);
      if (amount >= 1) {
        Game.executeMove();
      }
    };

    const onCancel = function () {
      if (drag) {
        drag = null;
      }
    };

    heapsEl.addEventListener(downEv, onDown, { passive: false });
    document.addEventListener(moveEv, onMove, { passive: false });
    document.addEventListener(upEv, onUp, { passive: false });
    if (cancelEv) {
      document.addEventListener(cancelEv, onCancel);
    }
  };

  // --- KI-Anschluss (Task 14) ---------------------------------------------------

  Game.isAIActive = function () {
    const s = Game.state;
    return s.active === 2 && Game.isAI(s.opponent);
  };

  Game.cancelAIMove = function () {
    if (Game._aiTimer !== undefined) {
      clearTimeout(Game._aiTimer);
      Game._aiTimer = undefined;
    }
    if (Game._animTimer !== undefined) {
      clearTimeout(Game._animTimer);
      Game._animTimer = undefined;
    }
    const s = Game.state;
    s.lock = false;
    const input = document.querySelector("#amount-input");
    if (input) { input.disabled = false; }
    Game.updateButtonState();
  };

  /**
   * Game.maybeAIMove() → void
   * Triggert automatisch den KI-Zug, wenn die KI dran ist (Task 14).
   * Neue Logik: vor dem Zug prüft die KI, ob der Mensch soeben in eine
   * Verliererposition gespielt hat (NIM-Summe ≠ 0) → dann lacht sie höhnisch
   * (charaktergetreu: Baxi/Ducola/Muisa).
   */
  Game.maybeAIMove = function () {
    const s = Game.state;

    if (!Game.isAIActive()) {
      return;
    }

    let total = 0;
    for (let i = 0; i < s.heaps.length; i++) {
      total += s.heaps[i];
    }
    if (total === 0) {
      return;
    }

    const activeName = s.name2;

    s.lock = true;
    const input = document.querySelector("#amount-input");
    if (input) { input.disabled = true; }
    Game.updateButtonState();

    const activeEl = document.querySelector("#active-player");
    if (activeEl) {
      activeEl.textContent = activeName + " denkt…";
    }

    Game.setFace(2, "🤔");
    Game.setBubble(2, randomInList(THINK_LINES));
    Game.renderCharacters();

    const delay = 600 + Math.random() * 300;
    const seq = Game._moveSeq;
    const timer = setTimeout(function () {
      if (seq !== Game._moveSeq) {
        return;
      }
      Game._aiTimer = undefined;

      if (!Game.isAIActive()) {
        return;
      }
      let curTotal = 0;
      for (let i = 0; i < s.heaps.length; i++) {
        curTotal += s.heaps[i];
      }
      if (curTotal === 0) {
        return;
      }

      try {
        // Laune der KI, bevor sie zieht (NIM-Summe vOR ihrem Zug):
        //   N ≠ 0 → Gewinnposition:
        //     Mensch hat soeben gezogen → er ihr die Gewinnposition gelassen
        //     → sie lacht höhnisch 😆.
        //   N = 0 → Verliererposition: sie KANN nicht mehr gewinnen
        //     → sie wird wütend und murrt 😠 (Willys Kern-Wunsch).
        if (typeof window.Nim !== "undefined" &&
            typeof window.Nim.nimSum === "function") {
          const N = window.Nim.nimSum(s.heaps, s.allowed);
          if (N !== null && N !== undefined) {
            if (N !== 0 && s.lastMove && s.lastMove.player === 1) {
              Game.setFace(2, "😆");
              Game.setBubble(2, randomInList(AI_LAUGH_LINES));
            } else if (N === 0) {
              Game.setFace(2, "😠");
              Game.setBubble(2, randomInList(AI_ANGRY_LINES));
            }
            Game.renderCharacters();
          }
        }

        const move = window.AI.chooseMove(s.heaps, s.allowed, s.opponent);

        Game.animateAndRemove(move.heapIdx, move.amount, function () {
          s.lastMove = { player: s.active, heapIdx: move.heapIdx, amount: move.amount };
          s.active = (s.active === 1) ? 2 : 1;

          s.selectedHeap = -1;
          const inp = document.querySelector("#amount-input");
          if (inp) { inp.value = ""; }
          const err = document.querySelector("#input-error");
          if (err) {
            err.hidden = true;
            err.textContent = "";
          }
          if (s.heaps.length === 1) {
            s.selectedHeap = 0;
          }

          Game.render();
          Game.checkWin();
          Game.maybeAIMove();
        });
      } catch (e) {
        console.error("KI-Zug fehlgeschlagen:", e);
        s.lock = false;
        const inp = document.querySelector("#amount-input");
        if (inp) { inp.disabled = false; }
        Game.updateButtonState();
        const activeEl2 = document.querySelector("#active-player");
        if (activeEl2) {
          activeEl2.textContent = s.name2;
        }
        Game.setFace(2, "😵");
        Game.renderCharacters();
      }
    }, delay);
    Game._aiTimer = timer;
  };

  // --- Game.render() ------------------------------------------------------------

  /**
   * Game.render() → rendert Game.state in das vorhandene DOM (arch §3.2).
   * Neu: Characters-Cards, Sprechblasen, Vorschau + Undo-Button-Status.
   */
  Game.render = function () {
    const s = Game.state;

    if (s.selectedHeap >= 0 &&
        s.selectedHeap < s.heaps.length &&
        s.heaps[s.selectedHeap] < 1) {
      s.selectedHeap = firstNonEmptyHeap(s.heaps);
    }

    // 0. Characters-Cards anlegen (einmalig), falls noch nicht vorhanden.
    const charWrap = (typeof document !== "undefined")
      ? document.querySelector("#characters") : null;
    if (charWrap && !charWrap.querySelector(".char-card")) {
      for (let p = 1; p <= 2; p++) {
        const card = document.createElement("div");
        card.id = "char-" + p;
        card.className = "char-card";
        const faceEl = document.createElement("span");
        faceEl.className = "char-face";
        faceEl.textContent = "🙂";
        const nameEl = document.createElement("div");
        nameEl.className = "char-name";
        nameEl.textContent = "";
        const roleEl = document.createElement("div");
        roleEl.className = "char-role";
        roleEl.textContent = "";
        const bubbleEl = document.createElement("p");
        bubbleEl.className = "bubble";
        bubbleEl.textContent = "";
        card.appendChild(faceEl);
        card.appendChild(nameEl);
        card.appendChild(roleEl);
        card.appendChild(bubbleEl);
        charWrap.appendChild(card);
      }
    }

    // 1. Haufen + Steine
    const heapsEl = document.querySelector("#heaps");
    heapsEl.textContent = "";
    s.heaps.forEach(function (size, i) {
      const heap = document.createElement("div");
      const empty = size < 1;
      heap.className = empty ? "heap heap--empty" : "heap";
      heap.dataset.heapIndex = String(i);
      heap.tabIndex = empty ? -1 : 0;
      heap.setAttribute("role", empty ? "none" : "button");
      if (!empty) {
        heap.setAttribute("aria-pressed", i === s.selectedHeap ? "true" : "false");
      }

      const head = document.createElement("div");
      head.className = "heap-head";
      const label = document.createElement("p");
      label.className = "heap-label";
      label.textContent = "Haufen " + (i + 1);
      const count = document.createElement("p");
      count.className = "pile-count";
      const badge = document.createElement("span");
      badge.className = "count-badge";
      badge.textContent = String(size);
      count.appendChild(badge);
      head.appendChild(label);
      head.appendChild(count);
      heap.appendChild(head);

      const stonesWrap = document.createElement("div");
      stonesWrap.className = "heap-stones";
      stonesWrap.setAttribute("aria-hidden", "true");
      if (!empty) {
        for (let k = 0; k < size; k++) {
          const stone = document.createElement("span");
          stone.className = "stone";
          stonesWrap.appendChild(stone);
        }
      } else {
        const emptyNote = document.createElement("span");
        emptyNote.className = "empty-note";
        emptyNote.textContent = "leer 😴";
        stonesWrap.appendChild(emptyNote);
      }
      heap.appendChild(stonesWrap);

      heapsEl.appendChild(heap);
    });

    // 2. Status-Block (aria-live="polite")
    const activeName = s.active === 1 ? s.name1 : s.name2;
    document.querySelector("#active-player").textContent = activeName;

    let lastText = "–";
    if (s.lastMove) {
      const name = s.lastMove.player === 1 ? s.name1 : s.name2;
      lastText = name + " hat " + s.lastMove.amount +
        " aus Haufen " + (s.lastMove.heapIdx + 1) + " genommen";
    }
    document.querySelector("#last-move").textContent = lastText;

    // 3. Vorschau + Auswahl + Button + Undo + Characters
    const preview = document.querySelector("#amount-preview");
    if (preview) {
      const amt = Game.readAmount();
      preview.textContent = (amt !== null) ? String(amt) : "–";
    }

    Game.renderSelection();
    Game.updateButtonState();
    Game.renderCharacters();
  };

  // --- Boot ---------------------------------------------------------------------
  // Start: einmalig Events binden (DOM ist beim Laden vorhanden).
  Game.bindEvents();

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { Game.start(); }, { once: true });
    } else {
      Game.start();
    }
  }
})(window.Game);
