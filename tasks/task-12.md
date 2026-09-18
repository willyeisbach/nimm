# Task 12 – `game.js`: Zugübergabe, Sieg-Erkennung & „Neues Spiel"

> **Wichtig für dich (KI):** Lies vor Beginn **`architecture.md`** §2.1, §3.2, §3.7
> und **`requirements.md`** §5.1, §5.3, §5.6. Diese Datei ist **selbsterklärend**:
> Du brauchst nur sie, die zwei Docs und den unten beschriebenen **Codestand** —
> **keine anderen Task-Dateien** lesen.

## Lies zuerst
- `requirements.md` → §5.3 (nach Ausführung: Feld leeren, Auswahl zurücksetzen, Übergabe), §5.6 (Sieg & neues Spiel), §5.1 (Aktiver Spieler, Letzter Zug).
- `architecture.md` → §2.1, §3.2, §3.7 (Zugsperrung, Spielende).

## Ausgangszustand (Code, den du vorfindest)
- `game.js` enthält bereits (aus Task 08–11): `Game.state` (inkl. `active`,
  `lastMove`, `lock`), `Game.start()`, `Game.render()`, Auswahl + Validierung,
  `Game.animateAndRemove(heapIdx, amount)` (blinkt, entfernt, sperrt, gibt `lock` frei).
- Du **erweiterst** `game.js` um die Zug-Ausführung (Button-Handler) + Übergabe +
  Sieg-Overlay + „Neues Spiel".

## Ziel

### `Game.executeMove()` (Button „Ziehen" Handler)
1. Vorbedingung: `!Game.state.lock` **und** `Game.validateInput()` ist `true`
   (sonst ignorieren).
2. Ermittle `heapIdx` (aus `selectedHeap`) und `amount` (aus Input).
3. Ruft `Game.animateAndRemove(heapIdx, amount)` auf, **mit einem Callback**
   (oder einem `then`/`finally`-Mechanismus), der nach der Entfernung:
   - `Game.state.lastMove = { player: Game.state.active, heapIdx, amount }`.
   - **Aktiven Spieler wechselt**: `active = (active === 1) ? 2 : 1`.
   - **Input leert** und **ausgewählten Haufen zurücksetzt**
     (bei 1 Haufen: automatisch neu auswahlen).
   - Ruft `Game.render()` auf.
   - Ruft `Game.checkWin()` auf.

### `Game.checkWin()`
- Wenn **keine** Haufen mehr Steine enthalten (Summe `Game.state.heaps` === 0):
  - Zeigt das **Sieg-Overlay** (`#win-overlay` → `hidden` entfernen) mit
    `„🎉 Gewonnen hat <Name>!"` — der Name des Spielers, der **gezogen hat**
    (also `lastMove.player`, nicht der neu aktive).
  - Button **„Neues Spiel"** im Overlay.

### `Game.newGame()` (Button „Neues Spiel" Handler)
- Versteckt das Sieg-Overlay.
- Ruft `Game.start()` auf (**aktuelle** Parameter-Settings, neue zufällige
  Haufen, **zufälliger** Beginns-Spieler) und rendert.

## Relevante Vorgaben (Zusammenfassung)
- Nach Ausführung: Eingabefeld leeren, ausgewählten Haufen zurücksetzen,
  Zugübergabe an nächsten Spieler. → `req §5.3`.
- Letzter Stein → **Gratulation** (Name prominent) + Button **„Neues Spiel"**;
  Neues Spiel setzt mit **aktuellen** Parametern zurück, neue zufällige Haufen,
  **zufälliger** Spieler beginnt. → `req §5.6`.
- Aktiver Spieler + Letzter Zug werden angezeigt. → `req §5.1`.
- Während Animation/KI sind Eingaben gesperrt. → `arch §3.7`.

## Umsetzungshinweise
- Sieger-Namen korrekt auflösen: der **ziehende** Spieler hat gewonnen
  (`lastMove.player`), weil „wer den letzten Stein nimmt, gewinnt".
- `executeMove` ist die zentrale Stelle, an der die Animation (Task 11) und
  die KI (Task 14) zusammenkommen — halte die Callback-Struktur sauber.
- `newGame()` ändert die Konfiguration **nicht** (bleibt, wie in Task 13 gesetzt),
  nur der Laufzeit-Zustand.

## Abnahmekriterien (überprüfbar – Sichtprüfung)
- [ ] Zug S1 → S2: Status wechselt den Namen; „Letzter Zug" zeigt den S1-Zug
      („`<Name>` hat `<n>` aus Haufen `<i>` genommen").
- [ ] Input ist nach dem Zug **leer**, Auswahl zurückgesetzt.
- [ ] Letzter Stein genommen → Overlay erscheint mit dem **korrekten**
      Sieger-Namen (dem, der gezogen hat).
- [ ] „Neues Spiel" → Overlay verschwindet, **neue** Haufen, **zufälliger**
      Startspieler; Konfiguration bleibt erhalten.
- [ ] Kein Doppelzug: Schnelle Doppelklicks auf „Ziehen" während `lock` → nur
      **ein** Zug wird ausgeführt.
- [ ] Keine Konsolenfehler.

## Definition of Done
Zugausführung (mit Animation), korrekte Spieler-Übergabe, Letzter-Zug-Anzeige,
Sieg-Erkennung mit korrektem Sieger-Namen und funktionierendes „Neues Spiel"
sind vorhanden.
