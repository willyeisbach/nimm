# Task 16 – Endabnahme E2E (req §8 + arch §5)

> **Wichtig für dich (KI):** Lies vor Beginn **`architecture.md`** §5 (A7-Checkliste)
> und **`requirements.md`** §8 (Abnahmekriterien). Diese Datei ist
> **selbsterklärend**: Du brauchst nur sie, die zwei Docs und den unten
> beschriebenen **Codestand** — **keine andere Task-Datei** lesen.

## Lies zuerst

- `requirements.md` → §8 (12 Abnahmekriterien, A1–A12).
- `architecture.md` → §5 (A7-Checkliste, 8 Items).

## Ausgangszustand (Code, den du vorfindest)

- **Alle 15 Tasks** sind abgeschlossen: `nim.js`, `ai.js`, `game.js` sind final,
  `index.html` + `style.css` sind fertig, das Spiel läuft **doppelklickfähig**
  via `file://` (Windows/macOS/Linux), ohne Build-Tools, ohne Netzwerk.
- Dein Auftrag: **Nur prüfen und ggf. kleine Lücken schließen** — keine
  Architekturänderungen.

## Ziel

Die **12** `req §8`-Items **und** die **8** `arch §5`-Items (A7) abhaken.
Jedes Item: **bestanden / nicht bestanden** + ggf. Fix-PR/Commit-Referenz.

## Abnahmekriterien — `req §8`

- [x] **A1** Doppeltklick auf `index.html` öffnet die Seite (Chrome,
      Linux/Win/macOS) ohne Fehler in der Konsole.
      _Evidenz: `file://`-Reload + pageerror/console-listener → 0 Fehler;
      kurzer Zug nach Reload ebenfalls fehlerfrei._
- [x] **A2** Standard-Start: 1 Haufen, 10–20 Steine, zufälliger Beginns-Spieler.
      _Evidenz: `heaps=[1 Haufen, 10–20]`, `active ∈ {1,2}` nach Boot._
- [x] **A3** Alle drei Zugregeln (Klassisch / 4er / Eigene Liste) funktionieren;
      ungültige „Eigene Liste" wird im UI abgefangen.
      _Evidenz: classic → Zug mit 2 ok (heaps 17→15); own `1,3,5` → Zug mit 3 ok,
      Zug mit 2 blockiert (Draw disabled + Fehler-Text); ungültige Liste
      (ohne `1`) → Fehler-Text + Übernehmen disabled._
- [x] **A4** Gegen **Baxi**: in Gewinnposition → NIM-Summe wird auf 0 gesetzt;
      in Verliererposition → 1 aus größtem Haufen. (Per Konsole verifizierbar.)
      _Evidenz (Node): `AI.chooseMove([10,7,3],null,"Baxi")` → Ziel-NimSumme 0;
      `AI.chooseMove([3,3],null,"Baxi").amount === 1`. PASS._
- [x] **A5** Gegen **Ducola**: > 10 Steine → i. d. R. Gewinnposition für Gegner;
      ≤ 10 → optimal.
      _Evidenz (Node): [12,5,3] → teilerhaltend (NimSumme≠0 für Gegner);
      [5,3] → Ziel-NimSumme 0. PASS._
- [x] **A6** Gegen **Muisa**: > 5 Steine → zufällig; ≤ 5 → optimal.
      _Evidenz (Node): [8] → legaler Zufallszug; [3,1] → Ziel-NimSumme 0. PASS._
- [x] **A7** Letzter Stein → Sieg-Overlay mit korrektem Namen + „Neues Spiel".
      _Evidenz: Overlay-Text `„🎉 Gewonnen hat Baxi!"` inkl. Button „Neues Spiel";
      auch mit Mensch vs. Mensch und menschlichem Sieg geprüft._
- [x] **A8** „Neues Spiel" → neue zufällige Haufen, zufälliger Start, Parameter
      bleiben erhalten.
      _Evidenz: nach `new-game-btn`: neue `heaps` (alle 10–20), `active` neu zufällig,
      `rule/opponent/name2/maxHaufen/maxSteine/minSteine/allowed` unverändert,
      `lastMove === null`._
- [x] **A9** Options-Dialog: alle Parameter änderbar, Validierung korrekt,
      KI-Namen-Vorbelegung, „Abbrechen" ohne Änderung.
      _Evidenz: echter Radio-Klick `opt-opponent → Baxi` → `#opt-name2 = „Baxi"`
      (Prefill), `Game.state.name2` bleibt „Spieler 2" bis apply; apply → State
      committed; cancel → State unverändert. Ungültige own-Liste blockiert apply;
      Escape → Focus-Return auf `#options-btn`._
      _Test-Artefakt: `page.check` auf bereits gechecktes Radio feuert kein
      change-Event → Prefill lief nicht. Kein App-Bug._
- [x] **A10** Blink-Animation vor jeder Stein-Entfernung (3–4 Blips), Eingaben
      gesperrt währenddessen.
      _Evidenz: `.blinking`-Klasse auf Zielen, `#amount-input.disabled === true`
      während Lock, nach Finalize wieder frei; Doppelzug-Nachweis: genau 3
      Steine entfernt, nicht 6._
      _INFO: `#draw-btn` bleibt während Animation sichtbar enabled, aber alle
      Handler sind lock-guarded (`isLocked()`), Input disabled → kein Doppelzug._
- [x] **A11** Responsive: 320/375/768/1440 px ohne Überlauf; mobile Touch-Ziele.
      _Evidenz: `scrollWidth === clientWidth` bei 320/375/768/1440;
      `#options-btn` 44×44 px, `#draw-btn` ≥ 44 px Höhe in allen Viewports._
      _`#new-game-btn` nur im Win-Overlay (dynamisch erzeugt) — korrekt so._
- [x] **A12** Barrierefreiheit: Tastatur-Vollabdeckung, Labels, `aria-live`,
      `aria-invalid`.
      _Evidenz: Tab-Order `options-btn → heap → amount-input → draw-btn`;
      Dialog-Focus-Trap zirkuliert korrekt (15 Tabs); Escape → Focus auf
      `#options-btn`; 7 `label[for]` für alle relevanten Inputs;
      `#status` `aria-live="polite"`; `aria-disabled` auf `#draw-btn`;
      `role="button"` auf `.heap`; `aria-invalid` bei Validierungsfehler._

## Abnahmekriterien — `arch §5` (A7-Checkliste)

- [x] **a7.1** `grep -rn 'type="module"\|\bimport \b\|\bexport \b|fetch(|cdn\.\|@import' index.html *.css *.js`
      → **keine Treffer**.
      _Evidenz: grep ausgeführt, keine Treffer._
- [x] **a7.2** `grep -rn "console.log\|console.warn" *.js` → **keine Treffer**.
      _Evidenz: grep ausgeführt, keine Treffer._
- [x] **a7.3** Script-Ladereihenfolge: `nim.js` → `ai.js` → `game.js`,
      am **Ende** von `<body>`, **ohne** `defer`/`async`/`type="module"`.
      _Evidenz: `index.html` Zeilen 105–107: drei `<script src>` in korrekter
      Reihenfolge, alle ohne Attribute; am Ende von `</body>`._
- [x] **a7.4** Kein externes Netzwerk: `grep -rn "http://\|https://\|@import\|url(" style.css index.html`
      → **keine** externen URLs.
      _Evidenz: grep ausgeführt, keine externen URLs._
- [x] **a7.5** `window.Nim`, `window.AI`, `window.Game` sind nach Laden
      verfügbar (Konsole: `typeof Nim !== "undefined"` etc.).
      _Evidenz: Browser-Konsole nach Boot: alle drei `"object"`._
- [x] **a7.6** `Nim.parseAllowed`, `Nim.grundyTable`, `Nim.nimSum`,
      `Nim.optimalMove`, `Nim.randomLegal`, `Nim.isLegal`, `Nim.legalAmount`
      sind alle unter `window.Nim` erreichbar.
      _Evidenz (Node): alle 7 Funktionen `typeof Nim.X === "function"`. PASS._
- [x] **a7.7** `AI.chooseMove` behandelt alle drei Charaktere;
      unbekannter `who` → klarer Fehler.
      *Evidenz (Node): Baxi/Ducola/Muisa legal; `AI.chooseMove([3],null,"???")`
      _wirft `Error`. PASS._
- [x] **a7.8** `Game.start()`, `Game.render()`, `Game.executeMove()`,
      `Game.animateAndRemove()`, `Game.maybeAIMove()`, `Game.checkWin()`,
      `Game.newGame()` sind alle unter `window.Game` erreichbar.
      _Evidenz: Browser-Konsole: alle 7 `typeof Game.X === "function"`._

## Vorgehen (konkret)

1. **Frühen Morgen** (frischer Browser, kein Cache): `file://`-Doppeltklick →
   A1–A3.
2. **KI-Verifikation** (A4–A6): In der Konsole:
   ```js
   // Baxi in Gewinnposition:
   Nim.nimSum([10, 7, 3], null); // !== 0
   const m = AI.chooseMove([10, 7, 3], null, "Baxi");
   const pos = [10, 7, 3];
   pos[m.heapIdx] -= m.amount;
   Nim.nimSum(pos, null); // === 0  ✓
   // Baxi in Verliererposition:
   AI.chooseMove([3, 3], null, "Baxi"); // amount === 1, heapIdx auf größtem
   ```
   Analog für Ducola (Schwelle 10) und Muisa (Schwelle 5).
3. **Sieg + Neues Spiel** (A7–A8): Letzter Stein → Overlay → „Neues Spiel" →
   neue Haufen, Startspieler, Parameter erhalten.
4. **Options** (A9): Alle Felder, alle Validierungspfade, KI-Namen-Vorbelegung.
5. **Animation** (A10): Blink sichtbar, `lock` während, danach frei.
6. **Responsive** (A11): DevTools-Device-Emulation 320/375/768/1440 px.
7. **Barrierefreiheit** (A12): Tastatur-Tab-Order, Labels, `aria-*`-Attribute.
8. **A7-Checkliste**: Alle 8 greps + `typeof`-Prüfungen in der Konsole.

## Definition of Done

**Alle 20 Items** (12 `req §8` + 8 `arch §5`) sind **bestanden** — das Spiel ist
fertig, doppelklickfähig, barrierefrei, responsiv, ohne externe Abhängigkeiten.
Ggf. kleine Fixes aus der Prüfung sind dokumentiert und im Code enthalten.

## Abnahme-Protokoll (Task 16, 2026-07)

- **Durchgeführt von:** KI-Agent (direkt, nach 2 fehlgeschlagenen Ollama-Subagent-Läufen).
- **Umgebung:** Chrome (Headless via Playwright), `file://`-Doppeltklick, Linux.
- **Ergebnis:** **20 / 20 bestanden.** Keine Code-Änderungen nötig.
- **Dokumentierte INFOs / Test-Artefakte (keine App-Bugs):**
  1. **A9 Prefill-Test-Artefakt:** `page.check()` auf ein bereits gechecktes
     Radio feuert kein `change`-Event → `prefillAIName()` lief nicht.
     Echtes Radio-Klicken (State zuvor `Mensch`) → Prefill korrekt.
  2. **A10 INFO:** `#draw-btn` bleibt während der Animation sichtbar enabled,
     aber `#amount-input` ist disabled und alle Handler sind lock-guarded
     (`Game.isLocked()`). Doppelzug-Nachweis: genau 3 Steine entfernt, nicht 6.
  3. **A8 Feldnamen:** `Game.state.maxSteine`/`minSteine` (nicht `maxStones`).
     Erste Prüfung nutzte falsche Feldnamen → korrekt bei Wiederverifizierung.
  4. **A11 `#new-game-btn`:** nur im Win-Overlay vorhanden (dynamisch erzeugt
     in `showWinOverlay()`), nicht im Haupt-UI — korrekt so.
- **Git:** HEAD `7558d76` (Task 15), sauberes Tree; `node --check` für alle
  drei JS-Dateien sauber.
