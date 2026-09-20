# Task 08 – `game.js`: Spielzustand, Defaults & Haufengenerierung

> **Wichtig für dich (KI):** Lies vor Beginn **`architecture.md`** §2.1, §3.3, §3.4
> und **`requirements.md`** §3.1, §3.3 und §9 (Bestätigte Entscheidungen). Diese
> Datei ist **selbsterklärend**: Du brauchst nur sie, die zwei Docs und den unten
> beschriebenen **Codestand** — **keine anderen Task-Dateien** lesen.

## Lies zuerst

- `requirements.md` → §3.1 (Parameter & Defaults), §3.3 (Haufen-Generierung), §9 (Bestätigte Entscheidungen).
- `architecture.md` → §2.1 (`game.js` = Zustand/UI), §3.3 (Options-Dialog), §3.4 (Einstieg).

## Ausgangszustand (Code, den du vorfindest)

- `nim.js` **fertig**, `ai.js` **fertig** (alle drei Charaktere).
- `index.html` enthält das Skelett-Markup aus Task 01 (Haufen-Container,
  Status-Block, Input, Button, Zahnrad, Overlay) und lädt
  `nim.js → ai.js → game.js`.
- `game.js` enthält aktuell **nur**:
  ```js
  window.Game = window.Game || {};
  ```
- Du **erweiterst** `game.js` um Zustand + Generierung + `start()`.

## Ziel

In `game.js` (unter `window.Game`) implementieren:

### `Game.state`

Spielzustand im Speicher (keine Persistenz). Enthalte mindestens:

```js
Game.state = {
  maxHaufen,
  rule,
  maxSteine,
  minSteine, // Konfiguration
  opponent,
  name1,
  name2, // Gegner + Namen
  heaps, // Array der aktuellen Haufengrößen
  active, // 1 oder 2 (aktiver Spieler)
  lastMove, // null oder { player, heapIdx, amount }
  lock, // boolean, true während Animation/KI-Zug (für spätere Tasks)
};
```

### `Game.defaults()` → Default-Objekt

Liefert die Defaults aus `req §3.1`:
`maxHaufen=1`, `rule="4er"`, `maxSteine=20`, `minSteine=10`,
`opponent="Mensch"`, `name1="Spieler 1"`, `name2="Spieler 2"`.

### `Game.newHeaps()` → `heaps` (Array)

- Anzahl der Haufen = Zufallszahl in `[1, maxHaufen]` (ganzzahlig, inklusiv).
- Größe jedes Haufens = unabhängige Zufallszahl in `[minSteine, maxSteine]`.
- Zufall über `window.crypto.getRandomValues` (s. `architecture.md §3.1`).
- Nutzt die **aktuellen** Konfigurationswerte aus `Game.state`.

### `Game.start()`

- Setzt `Game.state.heaps = Game.newHeaps()`.
- Setzt `Game.state.active` = **zufälliger** Spieler (1 oder 2, je 50/50).
- Setzt `Game.state.lastMove = null`, `Game.state.lock = false`.
- Leitet die erlaubten Mengen `A` aus `Game.state.rule` ab
  (via `Nim.parseAllowed`) und hält sie für spätere Tasks bereit
  (z. B. als `Game.state.allowed`).
- (Rendering/Event-Listener kommen in späteren Tasks — hier nur Zustand.)

## Relevante Vorgaben (Zusammenfassung)

- Defaults: **1 Haufen max**, Größe **10–20**, **4er-Nimm**, Spieler 2 = **Mensch**,
  **zufälliger** Spieler beginnt. → `req §3.1`, `req §8`.
- Haufenzahl zufällig in `[1, maxHaufen]`; jede Größe zufällig in
  `[minSteine, maxSteine]`. → `req §3.3`, `req §9`.
- Zustand im Speicher; Neuladen startet mit Defaults neu. → `req §1`.
- `game.js` = Zustand + UI; nutzt `nim.js`/`ai.js` nur durch Aufruf.
  → `arch §2.1`.

## Umsetzungshinweise

- Exponiere eine interne Zufallsfunktion, die `crypto.getRandomValues` nutzt
  und einen ganzzahligen Wert in `[min, max]` (inklusiv) liefert.
- `Game.start()` soll idempotent sein (erneuter Aufruf → frischer Zustand).
- Halte die Konfiguration und den Laufzeit-Zustand sauber getrennt
  (Konfiguration wird in Task 13 via Options-Dialog geändert, danach `start()`).

## Abnahmekriterien (überprüfbar – Konsole)

- [ ] `Game.start()` (Defaults) → `Game.state.heaps.length === 1`,
      `heaps[0] ∈ [10, 20]`.
- [ ] `Game.state.active ∈ {1, 2}`; `lastMove === null`; `lock === false`.
- [ ] `Game.state.allowed` entspricht `Nim.parseAllowed("4er")` → `[1,2,3,4]`.
- [ ] Temporär `Game.state.maxHaufen = 3`, `minSteine=2, maxSteine=9`;
      `Game.newHeaps()` 100× → Längen immer in `[1,3]`, jede Größe in `[2,9]`.
- [ ] `Game.start()` mehrmals → Zustand wird jeweils sauber zurückgesetzt.
- [ ] Keine Konsolenfehler.

## Definition of Done

`Game.state`, `Game.defaults`, `Game.newHeaps` und `Game.start()` sind vorhanden,
Defaults und Zufalls-Generierung sind korrekt, und `game.js` ist der zentrale
Zustands-Anker für die folgenden UI-Tasks.
