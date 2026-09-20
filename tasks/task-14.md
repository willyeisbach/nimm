# Task 14 – `game.js`: KI-Anschluss (automatischer Zug + Denk-Delay)

> **Wichtig für dich (KI):** Lies vor Beginn **`architecture.md`** §2.1, §3.1, §3.2
> und **`requirements.md`** §4.5 (KI-UX) und §4 (Charaktere). Diese Datei ist
> **selbsterklärend**: Du brauchst nur sie, die zwei Docs und den unten
> beschriebenen **Codestand** — **keine andere Task-Datei** lesen.

## Lies zuerst

- `requirements.md` → §4.5 (KI zieht automatisch, „Denk"-Delay ~600–900 ms, Blink-Animation, Eingaben gesperrt).
- `architecture.md` → §2.1 (`game.js` ruft `ai.js` auf), §3.1 (Zufall/Delay), §3.7 (Zugsperrung).

## Ausgangszustand (Code, den du vorfindest)

- `ai.js` ist **fertig**: `AI.chooseMove(position, A, who)` → `{ heapIdx, amount }`
  für **Baxi / Ducola / Muisa** (und „Mensch" ist kein KI-Charakter).
- `game.js` enthält bereits (aus Task 08–13): `Game.state` (inkl. `opponent`,
  `active`, `lock`), `Game.render()`, `Game.executeMove()`, `Game.animateAndRemove`,
  `Game.checkWin()`, `Game.newGame()`, Options-Dialog.
- Du **erweiterst** `game.js` um das KI-Automatik-Verhalten.

## Ziel

In `game.js` implementieren:

### `Game.maybeAIMove()`

Ruft man **nach jedem Zustandwechsel**, an dem ein Spieler am Zug ist
(nach `start()`, nach jeder Zugübergabe in `executeMove`):

1. Bestimme den Namen des aktiven Spielers (aus `Game.state.name1`/`name2`) **und**
   ob der aktive Spieler eine **KI** ist.
   - **KI-Erkennung:** Der aktive Spieler ist KI, wenn
     - er **Spieler 2** ist **und** `Game.state.opponent ∈ {Baxi, Ducola, Muisa}`,
     - **oder** (optional, falls Spieler 1 auch KI sein könnte — hier aber
       Spieler 1 immer menschlich, s. `req §9`) — in diesem Projekt **Spieler 1
       ist immer der Mensch**, also nur Spieler 2 kann KI sein.
2. **Nur wenn der aktive Spieler eine KI ist**:
   - Setze `Game.state.lock = true` (Eingaben sperren, s. Task 11).
   - Kurzes Feedback: Status zeigt kurz „`<Name>` denkt…".
   - Warte **~600–900 ms** („Denk"-Effekt; `Math.random()` für die Variation ist
     erlaubt, s. `arch §3.1`).
   - Rufe `AI.chooseMove(Game.state.heaps, Game.state.allowed, <KI-Name>)` auf
     → `move = { heapIdx, amount }`.
   - Führe den Zug aus über denselben Pfad wie ein menschlicher Zug:
     `Game.animateAndRemove(move.heapIdx, move.amount, <Callback>)`,
     im Callback: `lastMove` setzen, Spieler wechseln, `render()`, `checkWin()`,
     und **erneut** `maybeAIMove()` (falls der **andere** Spieler auch KI wäre —
     hier der Fall „Mensch gegen KI": nach KI-Zug ist S1 dran → keine weitere
     KI-Aktion).
   - Setze `Game.state.lock = false` (wird in `animateAndRemove` gemacht).

### Sicherstellen, dass menschliche Züge die KI auslösen

- Am **Ende** von `Game.executeMove()` (nach `checkWin()` und Spielerwechsel)
  `Game.maybeAIMove()` aufrufen.
- Am **Ende** von `Game.start()` und `Game.newGame()` `Game.maybeAIMove()`
  aufrufen (Beginn kann zufällig KI sein).

## Relevante Vorgaben (Zusammenfassung)

- Zieht die KI (Spieler 2), geschieht dies **automatisch** nach kurzer Anzeige,
  dass die KI am Zug ist (Verzögerung **~600–900 ms**). → `req §4.5`.
- Auch KI-Züge lösen die **Blink-Animation** aus. → `req §4.5`.
- Eingaben sind während eines KI-Zugs **gesperrt**. → `req §4.5`, `arch §3.7`.
- „Denk"-Delay-Variation über `Math.random()` ist erlaubt (nicht-empfindliche
  Stelle). → `arch §3.1`.
- **Spieler 1 ist immer der menschliche lokale Spieler**; Spieler 2 = Gegner
  (Mensch oder KI). → `req §9`.

## Umsetzungshinweise

- **Wichtig:** Vermeide unendliche Schleifen, falls **beide** Spieler KI wären —
  in diesem Projekt ist Spieler 1 immer Mensch, aber defensive: `maybeAIMove`
  sollte prüfen, dass der neu-aktive Spieler wirklich eine KI ist, bevor es
  erneut feuert.
- „Denk"-Delay: `setTimeout` mit `600 + Math.random()*300` ms.
- Reuse den bestehenden `animateAndRemove` + Callback-Pfad (Task 11/12) — die KI
  sollte **exakt denselben** Zugausführungs-Pfad nehmen wie der Mensch.
- Achte darauf, dass `lock` auch beim KI-Zug korrekt gesperrt ist (Klicks auf
  „Ziehen" während des Denk-Wartens ignorieren).

## Abnahmekriterien (überprüfbar – Sichtprüfung/Konsole)

- [ ] Gegner **„Baxi"**, S2 am Zug (nach `start()` mit zufälligem S2-Start) →
      nach ~1 s zieht Baxi **selbst** (Blink-Animation sichtbar), danach ist S1 dran.
- [ ] Gegen Baxi durchspielen: In einer **Gewinnposition** für Baxi setzt dieser
      die NIM-Summe auf **0** (manuell per Konsole `Nim.nimSum` nachprüfen:
      nach Baxis Zug `nimSum === 0`).
- [ ] **Muisa** (Gegner): Bei > 5 Steinen zufälliger (i. d. R. nicht optimaler)
      Zug; bei ≤ 5 optimal.
- [ ] **Ducola** (Gegner): Bei > 10 Steinen lässt sie dem Gegner i. d. R. eine
      Gewinnposition; bei ≤ 10 optimal.
- [ ] **„Mensch"** als Gegner: **kein** automatischer Zug; S2 zieht manuell.
- [ ] Während des „Denk"-Wartens: Eingaben **gesperrt** (kein Doppelzug).
- [ ] Keine Konsolenfehler.

## Definition of Done

Die KI (Baxi/Ducola/Muisa) zieht **automatisch** mit „Denk"-Delay + Blink-Animation

- Zugsperrung, über denselben Pfad wie menschliche Züge, und „Mensch" als Gegner
  deaktiviert das KI-Verhalten vollständig.
