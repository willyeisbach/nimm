// game.js – Spielzustand, UI-Verdrahtung, Animation, Options (Logik in Task 8+)
// Task 08: Spielzustand, Defaults, Haufengenerierung, start().
// Reiner Zustand/Logik: kein DOM-Zugriff (Rendering & Events kommen in Task 9+).
window.Game = window.Game || {};

(function (Game) {
  "use strict";

  /**
   * Zufallszahl in [min, max] (ganzzahlig, beide Enden inklusiv) über
   * window.crypto.getRandomValues (s. architecture.md §3.1).
   */
  function randomInt(min, max) {
    const range = max - min + 1;
    if (range <= 0) {
      throw new Error("Game.randomInt: max muss ≥ min sein.");
    }
    // Bereich in 32-Bit-Vollbereich normieren, um Modulo-Bias zu minimieren.
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
   * Game.defaults() → Default-Konfiguration (req §3.1).
   */
  Game.defaults = function () {
    return {
      maxHaufen: 1,
      rule: "4er",
      maxSteine: 20,
      minSteine: 10,
      opponent: "Mensch",
      name1: "Spieler 1",
      name2: "Spieler 2"
    };
  };

  /**
   * Spielzustand im Speicher (keine Persistenz, req §1).
   * Konfigurationswerte kommen aus defaults() und werden bei Bedarf
   * (Task 13: Options-Dialog) ersetzt, danach Game.start().
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
    ownList: undefined, // nur bei rule === "own" gesetzt (Raw-String)
    // Laufzeit-Zustand
    heaps: [],         // Array der aktuellen Haufengrößen
    active: 1,         // 1 oder 2 (aktiver Spieler)
    lastMove: null,    // null oder { player, heapIdx, amount }
    selectedHeap: 0,   // 0-basiert: ausgewählter Ziel-Haufen (Task 10)
    allowed: null,     // erlaubte Mengen A (null = klassisch)
    lock: false        // true während Animation/KI-Zug (spätere Tasks)
  };

  /**
   * Game.isLocked() → boolean (Task 11).
   * Zentrale Abfrage, ob während Animation/KI-Zug gesperrt ist.
   * Alle Eingabepunkte (Klick, Tastatur, Input) prüfen dieses Flag.
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
    return heaps;
  };

  /**
   * Game.start() → frischer Spielzustand (idempotent).
   * Setzt Haufen, zufälligen Startspieler, lastMove/lock zurück und
   * leitet die erlaubten Mengen A aus der Regel ab (Nim.parseAllowed).
   */
  Game.start = function () {
    const s = Game.state;
    // Generation hochzählen (Fix 2): macht alle ausstehenden Animation-/KI-
    // Callbacks aus dem vorherigen Spiel stale (newHeaps() läuft nur über start()).
    Game._moveSeq = (Game._moveSeq || 0) + 1;
    // Defensive (arch §3.7): crypto-Pfad kann in exotischen Umgebungen werfen
    // (z. B. min > max durch ungültige Konfiguration) → sauber abbrechen.
    try {
      s.heaps = Game.newHeaps();
    } catch (e) {
      console.error("Haufengenerierung fehlgeschlagen:", e);
      return;
    }
    s.active = randomInt(1, 2);
    s.lastMove = null;
    s.lock = false;
    s.allowed = window.Nim.parseAllowed(s.rule, s.ownList);
    s.selectedHeap = 0; // 1 Haufen → automatisch Ziel; mehrere → erster

    // KI-Anschluss (Task 14): ausstehenden KI-Job räumen (neues Spiel!),
    // dann bei KI-Start automatisch den ersten KI-Zug auslösen.
    Game.cancelAIMove();
    Game.render();
    Game.maybeAIMove();
    return s;
  };

  /**
   * Game.selectHeap(idx) → wählt den Ziel-Haufen aus (Task 10).
   * Setzt Game.state.selectedHeap, spiegelt das im DOM-Highlight und
   * aktualisiert den Button-Status reaktiv.
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
    s.selectedHeap = idx;
    Game.renderSelection();
    Game.updateButtonState();
  };

  /**
   * Game.renderSelection() → spiegelt selectedHeap als "selected"-Klasse.
   * Nutzt das bestehende DOM (wird von render() + selectHeap() aufgerufen).
   */
  Game.renderSelection = function () {
    const s = Game.state;
    const heaps = document.querySelectorAll("#heaps .heap");
    heaps.forEach(function (el) {
      const i = parseInt(el.dataset.heapIndex, 10);
      if (i === s.selectedHeap) {
        el.classList.add("selected");
      } else {
        el.classList.remove("selected");
      }
    });
  };

  /**
   * Game.readAmount() → Zahl | null
   * Liest den Input "Steine zu nehmen" als positive Ganzzahl ein.
   * Leer/ungültig → null.
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
   * Gültig, wenn: Eingabe ist positive Ganzzahl ≥ 1 UND Menge ist per
   * Nim.legalAmount legal für den ausgewählten Haufen (deckt "∈ A" und
   * "≤ Haufengröße" ab). Nimmt s.rule / s.allowed / s.selectedHeap.
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
   * Game.updateButtonState() → zentrales Enable/Disable + Fehlermeldung
   * (Task 10). Setzt den "Ziehen"-Button auf disabled/aktiv und blendet
   * bei ungültiger Eingabe eine kleine Hinweismeldung ein.
   */
  Game.updateButtonState = function () {
    const btn = document.querySelector("#draw-btn");
    const err = document.querySelector("#input-error");
    const valid = Game.validateInput();
    if (btn) {
      btn.disabled = !valid;
      Game._setAriaDisabled(btn, !valid);
    }
    if (err) {
      err.textContent = valid ? "" : "Nicht gültig für den gewählten Haufen.";
      err.hidden = valid;
    }
  };

  /**
   * Game.render() → rendert Game.state in das vorhandene DOM (arch §3.2).
   * Kein diff-basiertes Rendering: Haufen-Container wird geleert und neu
   * gefüllt. Jedes .heap trägt data-heap-index (Hook für Task 10/11).
   */
  Game.render = function () {
    const s = Game.state;

    // 1. Haufen + Steine
    const heapsEl = document.querySelector("#heaps");
    heapsEl.textContent = "";
    s.heaps.forEach(function (size, i) {
      const heap = document.createElement("div");
      heap.className = "heap";
      heap.dataset.heapIndex = String(i);
      heap.tabIndex = 0;                 // Tastaturfokus (arch §3.6)
      heap.setAttribute("role", "button");
      heap.setAttribute("aria-pressed", i === s.selectedHeap ? "true" : "false");

      const label = document.createElement("p");
      label.className = "heap-label";
      label.textContent = "Haufen " + (i + 1) + " – " + size;
      heap.appendChild(label);

      for (let k = 0; k < size; k++) {
        const stone = document.createElement("span");
        stone.className = "stone";
        heap.appendChild(stone);
      }
      heapsEl.appendChild(heap);
    });

    // 2. Status-Block (aria-live="polite" ist im Markup gesetzt)
    const activeName = s.active === 1 ? s.name1 : s.name2;
    document.querySelector("#active-player").textContent = activeName;

    let lastText = "–";
    if (s.lastMove) {
      const name = s.lastMove.player === 1 ? s.name1 : s.name2;
      lastText = name + " hat " + s.lastMove.amount +
        " aus Haufen " + (s.lastMove.heapIdx + 1) + " genommen";
    }
    document.querySelector("#last-move").textContent = lastText;

    // 3. Auswahl-Highlight + Button-Status reaktiv auf den neuen Zustand
    Game.renderSelection();
    Game.updateButtonState();
  };

  /**
   * Game.animateAndRemove(heapIdx, amount, cb) (Task 11).
   * Blinkt die zu entfernenden Steine (letzte `amount` im Haufen),
   * sperrt währenddessen alle Eingaben, entfernt danach genau diese
   * Steine, aktualisiert Game.state.heaps, rendert neu und ruft
   * optionalen Callback auf (Task 12: Zugübergabe/Sieg-Check).
   *
   * Primär-Trigger: `animationend` auf dem ersten blinkenden Stein.
   * Safety-Net: `setTimeout(~1300 ms)`, falls animationend nicht feuert.
   */
  Game.animateAndRemove = function (heapIdx, amount, cb) {
    const s = Game.state;
    const heapSize = s.heaps[heapIdx];
    if (heapSize == null || amount == null || amount < 1 || amount > heapSize) {
      // Defensive: ungültige Parameter → nichts tun.
      if (typeof cb === "function") { cb(); }
      return;
    }

    // 1. Sperre setzen (alle Eingabepunkte prüfen Game.isLocked()).
    s.lock = true;
    Game.updateButtonState();
    const input = document.querySelector("#amount-input");
    if (input) { input.disabled = true; }

    // 2. Letzte `amount` Steine des Haufens mit .blinking markieren.
    const heapEl = document.querySelector(
      '#heaps .heap[data-heap-index="' + heapIdx + '"]'
    );
    if (!heapEl) {
      // Fallback: DOM fehlt → Sperre sofort wieder lösen.
      s.lock = false;
      if (input) { input.disabled = false; }
      Game.updateButtonState();
      if (typeof cb === "function") { cb(); }
      return;
    }
    const stones = heapEl.querySelectorAll(".stone");
    const targets = Array.prototype.slice.call(stones).slice(-amount);
    targets.forEach(function (el) { el.classList.add("blinking"); });

    // 3. Auf animationend ODER Timeout warten, dann aufräumen.
    let done = false;
    // Generation-Counter: markiert, für welchen "Zug" diese Animation läuft.
    // Wird bei start() hochgezählt → ein stale finalize bricht ab (Fix 2).
    const seq = Game._moveSeq;
    function finalize() {
      if (done) { return; }
      done = true;
      // Defensive (Fix 2): Zug ist nicht mehr aktuell – z. B. start()/newGame()/
      // applyOptions() ist im ~1,3 s-Animation-Fenster gefeuert → abbrechen,
      // OHNE den Haufen zu subtrahieren (verhindert Zustandskorruption).
      if (seq !== Game._moveSeq) { return; }

      // a) Genau die `amount` Steine aus dem DOM entfernen.
      targets.forEach(function (el) { el.remove(); });
      // b) .blinking-Klasse von allen Steinen entfernen (Säuberung).
      heapEl.querySelectorAll(".stone.blinking")
        .forEach(function (el) { el.classList.remove("blinking"); });

      // c) Zustand aktualisieren.
      s.heaps[heapIdx] = s.heaps[heapIdx] - amount;

      // d) Sperre lösen.
      s.lock = false;
      const inp = document.querySelector("#amount-input");
      if (inp) { inp.disabled = false; }
      Game.updateButtonState();

      // e) Neu rendern (Haufen-Größe + Status + Auswahl).
      Game.render();

      // f) Callback (Task 12: Zugübergabe/Sieg-Check).
      if (typeof cb === "function") { cb(); }
    }

    // Primär: animationend auf dem ersten Ziel-Stein (bubbling).
    if (targets.length) {
      targets[0].addEventListener("animationend", finalize, { once: true });
    }
    // Safety-Net: CSS `animation: blink 0.6s ease-in-out 2` → ~1200 ms.
    // Handle wird getrackt (Fix 2), damit cancelAIMove() ihn aufräumen kann.
    Game._animTimer = setTimeout(function () {
      Game._animTimer = undefined;
      finalize();
    }, 1300);
  };

  /**
   * Game.executeMove() → void
   * Handler des Buttons „Ziehen" (req §5.3, §5.5, §5.6).
   *
   * Ablauf:
   *   1. Guard: kein Zug, wenn gesperrt (Animation/AI-Zug) oder Eingabe ungültig.
   *   2. animateAndRemove → nach Entfernen:
   *      - lastMove setzen (Spieler = aktiver Spieler VOR dem Wechsel),
   *      - Zugübergabe (S1 ↔ S2),
   *      - Eingabe leeren, Auswahl zurücksetzen (bei 1 Haufen neu auswählen),
   *      - render,
   *      - checkWin → evtl. Win-Overlay.
   *
   * Kein Doppelzug: isLocked() wird synchron durch animateAndRemove gesetzt.
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

    Game.animateAndRemove(heapIdx, amount, function () {
      // lastMove: Spieler, der gezogen hat (aktiver Spieler VOR dem Wechsel).
      s.lastMove = { player: s.active, heapIdx: heapIdx, amount: amount };

      // Zugübergabe (req §5.3).
      s.active = (s.active === 1) ? 2 : 1;

      // Eingabe leeren, Auswahl zurücksetzen (req §5.3).
      s.selectedHeap = -1;
      const input = document.querySelector("#amount-input");
      if (input) {
        input.value = "1";
      }
      const err = document.querySelector("#input-error");
      if (err) {
        err.hidden = true;
        err.textContent = "";
      }

      // Bei genau einem Haufen direkt wieder auswählen (Praktikums-Hinweis req §5.2).
      if (s.heaps.length === 1) {
        s.selectedHeap = 0;
      }

      Game.render();
      Game.checkWin();

      // KI-Anschluss (Task 14): nach dem menschlichen Zug prüft maybeAIMove(),
      // ob die KI (Spieler 2) jetzt dran ist und löst ihren Zug aus.
      // Bei Gegner "Mensch" bricht die Funktion sofort ab.
      Game.maybeAIMove();
    });
  };

  /**
   * Game.checkWin() → void
   * Wenn die Summe aller Haufen 0 ist, zeigt es das Win-Overlay (req §5.6):
   *   „🎉 Gewonnen hat <Name>!" mit Button „Neues Spiel".
   * <Name> = Spieler, der den letzten Stein genommen hat (s.lastMove.player).
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
    Game.showWinOverlay(winnerName);
  };

  /**
   * Game.showWinOverlay(winnerName) → void
   * Zeigt #win-overlay mit Glückwunsch und Button „Neues Spiel" (req §5.6).
   */
  Game.showWinOverlay = function (winnerName) {
    const overlay = document.querySelector("#win-overlay");
    if (!overlay) {
      return;
    }
    overlay.innerHTML = "";

    const msg = document.createElement("p");
    msg.className = "win-message";
    msg.textContent = "\uD83C\uDF89 Gewonnen hat " + winnerName + "!";
    overlay.appendChild(msg);

    const btn = document.createElement("button");
    btn.id = "new-game-btn";
    btn.type = "button";
    btn.textContent = "Neues Spiel";
    btn.addEventListener("click", function () {
      Game.newGame();
    });
    overlay.appendChild(btn);

    overlay.hidden = false;
  };

  /**
   * Game.newGame() → void
   * Handler des Buttons „Neues Spiel" (req §5.6):
   * - Win-Overlay ausblenden,
   * - Spiel mit DEN aktuellen Parametern neu starten:
   *   neue Zufalls-Steinmengen, zufälliger Startspieler,
   * - Konfiguration bleibt unverändert (Optionen-Dialog, Task 13).
   */
  Game.newGame = function () {
    const overlay = document.querySelector("#win-overlay");
    if (overlay) {
      overlay.hidden = true;
    }
    // Eingabe zurücksetzen, damit der neue Startspieler mit Wert 1 beginnt.
    const input = document.querySelector("#amount-input");
    if (input) {
      input.value = "1";
    }
    Game.start();
  };

  // --- Options-Dialog (Task 13): Öffnen/Schließen, Validierung, Übernahme ----

  /**
   * Game.optionsOpen() → boolean. Ist der Options-Dialog aktuell sichtbar?
   */
  Game.optionsOpen = function () {
    const dlg = document.querySelector("#options-dialog");
    return !!(dlg && !dlg.hidden);
  };

  /**
   * Game.clearOptionErrors() → void
   * Setzt alle aria-invalid-Zustände zurück und blendt die Fehlermeldung aus.
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

  /**
   * Game.showOptionError(msg, fieldId) → void
   * Befüllt die Fehler-<p>, markiert das Feld per aria-invalid und sperrt
   * den „Übernehmen"-Button (req §3.1, arch §3.3/§3.6).
   */
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

  /**
   * Game.readOptionInt(fieldId) → Zahl | null
   * Liest ein number-Feld als Ganzzahl; leer/ungültig → null.
   */
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

  /**
   * Game.selectedRule() → "classic" | "4er" | "own"
   * Ermittelt die aktuell gewählte Zugregel per Radio-Button.
   */
  Game.selectedRule = function () {
    const el = document.querySelector("input[name=\"opt-rule\"]:checked");
    return el ? el.value : "4er";
  };

  /**
   * Game.selectedOpponent() → "Mensch" | "Baxi" | "Ducola" | "Muisa"
   */
  Game.selectedOpponent = function () {
    const el = document.querySelector("input[name=\"opt-opponent\"]:checked");
    return el ? el.value : "Mensch";
  };

  /**
   * Game.toggleOwnList() → void
   * Blendet/aktiviert das „Eigene Liste"-Feld nur, wenn diese Zugregel
   * gewählt ist (sauberes UX-Verhalten).
   */
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

  /**
   * Game.fillOptions() → void
   * Befüllt die Dialog-Felder aus Game.state (bzw. Defaults), damit der
   * Dialog die aktuelle Konfiguration zeigt (req §3.1).
   */
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
  };

  /**
   * Game._setAriaDisabled(btn, disabled) → void
   * Spiegelt disabled zusätzlich als aria-disabled (arch §3.6), damit
   * Screenreader den Zustand auch ohne native disabled-Attribute erfassen.
   */
  Game._setAriaDisabled = function (btn, disabled) {
    if (btn) {
      btn.setAttribute("aria-disabled", disabled ? "true" : "false");
    }
  };

  /**
   * Game._getFocusableOptions() → Array<Element>
   * Liefert alle fokussierbaren Elemente im Options-Dialog in DOM-Reihenfolge.
   * Nutzt das native :focusable-Pseudo (fallback: explizite Typenliste).
   */
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

  /**
   * Game.openOptions() → void
   * Öffnet den Dialog, befüllt die Felder aus Game.state, setzt den Fokus
   * aufs erste Feld, aktiviert den Focus-Trap (arch §3.6) und räumt Fehler an.
   */
  Game.openOptions = function () {
    const dlg = document.querySelector("#options-dialog");
    if (!dlg) {
      return;
    }
    // Element merken, das vor dem Öffnen Fokus hatte (für Focus-Return).
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

  /**
   * Game.closeOptions() → void
   * Schließt den Dialog und gibt den Fokus an das auslösende Element
   * zurück (arch §3.6). „Abbrechen" nutzt dies: das Spiel läuft unverändert
   * weiter (keine Änderung an Game.state).
   */
  Game.closeOptions = function () {
    const dlg = document.querySelector("#options-dialog");
    if (dlg) {
      dlg.hidden = true;
    }
    // Focus-Return: auf das auslösende Element (in der Regel das Zahnrad).
    const target = Game._optionsLastFocused;
    if (target && typeof target.focus === "function" && document.contains(target)) {
      target.focus();
    } else {
      const gear = document.querySelector("#options-btn");
      if (gear) { gear.focus(); }
    }
    Game._optionsLastFocused = null;
  };

  /**
   * Game._trapDialogFocus(ev) → void
   * Focus-Trap für den Options-Dialog: Tab/Shift+Tab zirkulieren innerhalb
   * des Dialogs; Escape schließt ihn (arch §3.6, req §6).
   */
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

  /**
   * Game.validateOptions() → boolean
   * Liest die AKTUELLEN Feldwerte (nicht Game.state) und validiert
   * (req §3.1, §6):
   *   - maxHaufen ≥ 1
   *   - minSteine ≥ 0, minSteine ≤ maxSteine
   *   - bei „Eigene Liste": Nim.parseAllowed("own", ownList) !== null
   * Bei Fehler: Fehler-<p> befüllen, aria-invalid setzen, „Übernehmen" disabled.
   */
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

    // Alle Checks bestanden → „Übernehmen" aktivieren.
    const applyBtn = document.querySelector("#opt-apply");
    if (applyBtn) {
      applyBtn.disabled = false;
      Game._setAriaDisabled(applyBtn, false);
    }
    return true;
  };

  /**
   * Game.prefillAIName() → void
   * Bei Auswahl einer KI (Baxi/Ducola/Muisa) wird das Name-2-Feld mit dem
   * KI-Namen vorbelegt (überschreibbar, req §3.1).
   */
  Game.prefillAIName = function () {
    const opp = Game.selectedOpponent();
    if (opp === "Baxi" || opp === "Ducola" || opp === "Muisa") {
      const el = document.querySelector("#opt-name2");
      if (el) {
        el.value = opp;
      }
    }
  };

  /**
   * Game.applyOptions() → void
   * Handler des Buttons „Änderung übernehmen":
   *   1. validateOptions() muss true sein (sonst Abbruch).
   *   2. Werte in Game.state schreiben (Konfiguration + Namen + Gegner).
   *   3. allowed neu über Nim.parseAllowed ableiten.
   *   4. Dialog schließen und Game.start() aufrufen (neues Spiel).
   */
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

    const name1 = (document.querySelector("#opt-name1") || {}).value;
    const name2 = (document.querySelector("#opt-name2") || {}).value;
    s.name1 = (name1 && name1.trim()) ? name1.trim() : "Spieler 1";
    s.name2 = (name2 && name2.trim()) ? name2.trim() : "Spieler 2";

    // allowed neu ableiten (Klassisch → null, sonst List).
    s.allowed = window.Nim.parseAllowed(s.rule, s.ownList);

    // Win-Overlay ausblenden, falls es offen ist.
    const overlay = document.querySelector("#win-overlay");
    if (overlay) {
      overlay.hidden = true;
    }

    Game.closeOptions();
    Game.start();
  };

  // --- Event-Anbindung (Task 10): Auswahl, Tastatur, Input-Validierung ----

  /**
   * Game.bindEvents() → bindet Klick/Tastatur auf .heap sowie den Input.
   * Idempotent (guard), da render() das Haufen-DOM neu aufbaut.
   */
  Game.bindEvents = function () {
    if (Game._eventsBound) {
      return;
    }
    Game._eventsBound = true;

    // Haufen: Auswahl per Klick (delegiert, da render() DOM neu baut).
    const heapsEl = document.querySelector("#heaps");
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

    // Input: reaktive Validierung bei jeder Änderung.
    const input = document.querySelector("#amount-input");
    if (input) {
      input.disabled = false;
      input.addEventListener("input", function () {
        if (Game.isLocked()) { return; }
        Game.updateButtonState();
      });
      input.addEventListener("change", function () {
        if (Game.isLocked()) { return; }
        Game.updateButtonState();
      });
    }

    // Button „Ziehen" (Task 12): executeMove mit Lock-Guard.
    const drawBtn = document.querySelector("#draw-btn");
    if (drawBtn) {
      drawBtn.addEventListener("click", function () {
        if (Game.isLocked()) {
          return;
        }
        Game.executeMove();
      });
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

    // Focus-Trap + Escape (Task 15, arch §3.6): nur aktiv, wenn der Dialog
    // geöffnet ist. Tab/Shift+Tab zirkulieren im Dialog, Escape schließt.
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

    // Zugregel-Radios: „Eigene Liste" ein-/ausblenden + live validieren.
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
        // Jede Änderung: Fehler zurücksetzen und neu validieren, damit
        // „Übernehmen" nur bei gültigen Werten aktiv ist.
        if (t.closest && t.closest("#options-dialog")) {
          Game.validateOptions();
        }
      });

      // Text-/Zahl-Felder: live validieren beim Tippen.
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

  // --- KI-Anschluss (Task 14) -----------------------------------------------

  /**
   * Game.isAIActive() → boolean
   * Liefert true, wenn der aktive Spieler die KI ist:
   * Spieler 2 ist aktiv UND opponent ist Baxi/Ducola/Muisa.
   * Spieler 1 ist in diesem Projekt immer menschlich.
   */
  Game.isAIActive = function () {
    const s = Game.state;
    return s.active === 2 &&
      (s.opponent === "Baxi" || s.opponent === "Ducola" || s.opponent === "Muisa");
  };

  /**
   * Game.cancelAIMove() → void
   * Räumt einen ausstehenden KI-Denk-Timer auf und setzt die Denk-Sperre
   * zurück. Wird zu Beginn von start() aufgerufen, damit „Neues Spiel"
   * oder „Optionen übernehmen" keine hängenden KI-Jobs zurücklässt.
   */
  Game.cancelAIMove = function () {
    if (Game._aiTimer !== undefined) {
      clearTimeout(Game._aiTimer);
      Game._aiTimer = undefined;
    }
    // Ausstehende Animation-Safety-Net aufräumen (Fix 2), damit kein alter
    // finalize-Callback auf neue Haufen feuert – transitiv auch über
    // start()/newGame()/applyOptions(), die alle start() → cancelAIMove() nutzen.
    if (Game._animTimer !== undefined) {
      clearTimeout(Game._animTimer);
      Game._animTimer = undefined;
    }
    const s = Game.state;
    if (s.lock === true) {
      s.lock = false;
      const input = document.querySelector("#amount-input");
      if (input) { input.disabled = false; }
      Game.updateButtonState();
    }
  };

  /**
   * Game.maybeAIMove() → void
   * Triggert automatisch den KI-Zug, wenn die KI dran ist (Task 14).
   *
   * Ablauf:
   *   1. Prüfen, ob der aktive Spieler die KI ist. Falls nicht → Return.
   *   2. Denk-Phase: Sperre setzen, Status „<Name> denkt…" zeigen,
   *      ~600–900 ms warten (nicht blockierend, via setTimeout).
   *   3. AI.chooseMove(position, allowed, opponent) → { heapIdx, amount }.
   *   4. Game.animateAndRemove() (EXISTIERENDE Pipeline – kein Parallelweg).
   *   5. Callback: lastMove setzen, Spieler wechseln, render, checkWin,
   *      dann maybeAIMove() rekursiv (defensive: bricht ab, wenn der
   *      neu-aktive Spieler nicht mehr die KI ist).
   *
   * Aufruforte:
   *   - am Ende von Game.start()
   *   - im Callback von Game.executeMove() (nach checkWin())
   *   - (Game.newGame() und Game.applyOptions() rufen beide start() auf)
   */
  Game.maybeAIMove = function () {
    const s = Game.state;

    if (!Game.isAIActive()) {
      return;
    }

    // Defensive: kein Zug, wenn das Spiel beendet ist.
    let total = 0;
    for (let i = 0; i < s.heaps.length; i++) {
      total += s.heaps[i];
    }
    if (total === 0) {
      return;
    }

    const activeName = s.name2; // KI ist immer Spieler 2

    // --- Denk-Phase: Sperre + Status + Delay ---
    s.lock = true;
    const input = document.querySelector("#amount-input");
    if (input) { input.disabled = true; }
    Game.updateButtonState();

    const activeEl = document.querySelector("#active-player");
    if (activeEl) {
      activeEl.textContent = activeName + " denkt…";
    }

    // Denk-Delay: 600 + random×300 → [600, 900) ms (req §5.5).
    const delay = 600 + Math.random() * 300;
    Game._aiTimer = setTimeout(function () {
      Game._aiTimer = undefined;

      // Defensive: erneut prüfen, dass noch die KI dran ist.
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
        const move = window.AI.chooseMove(s.heaps, s.allowed, s.opponent);

        // Bestehende Pipeline: animateAndRemove (Blink + Remove + Lock).
        Game.animateAndRemove(move.heapIdx, move.amount, function () {
          // lastMove setzen (KI, die gerade gezogen hat).
          s.lastMove = { player: s.active, heapIdx: move.heapIdx, amount: move.amount };

          // Zugübergabe.
          s.active = (s.active === 1) ? 2 : 1;

          // Eingabe zurücksetzen (analog executeMove).
          s.selectedHeap = -1;
          const inp = document.querySelector("#amount-input");
          if (inp) { inp.value = "1"; }
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

          // Defensive Rekursion: neuer aktiver Spieler ist in der Regel
          // Spieler 1 (menschlich) → maybeAIMove() bricht sofort ab.
          Game.maybeAIMove();
        });
      } catch (e) {
        // Defensive (arch §3.7): echter Fehler → protokollieren, nicht spammen.
        console.error("KI-Zug fehlgeschlagen:", e);
        s.lock = false;
        const inp = document.querySelector("#amount-input");
        if (inp) { inp.disabled = false; }
        Game.updateButtonState();
        const activeEl = document.querySelector("#active-player");
        if (activeEl) {
          activeEl.textContent = s.name2;
        }
      }
    }, delay);
  };

  // Start: einmalig Events binden (DOM ist beim Laden vorhanden).
  Game.bindEvents();

  // Boot (Fix 1): genau EINMAL Spiel mit Defaults starten (req §8,
  // architecture.md §3.4/§5). Guard hält den Code unter Node lauffähig.
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { Game.start(); }, { once: true });
    } else {
      Game.start();
    }
  }
})(window.Game);
