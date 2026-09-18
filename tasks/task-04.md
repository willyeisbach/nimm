# Task 04 – `nim.js`: NIM-Summe, Legitimität, optimaler & zufälliger Zug

> **Wichtig für dich (KI):** Lies vor Beginn **`architecture.md`** §2.1 und
> **`requirements.md`** §4.1 (Optimaler Zug / Verliererposition) und §6. Diese Datei
> ist **selbsterklärend**: Du brauchst nur sie, die zwei Docs und den unten
> beschriebenen **Codestand** — **keine anderen Task-Dateien** lesen.

## Lies zuerst
- `requirements.md` → §4.1 (NIM-Summe, optimaler Zug bei `N≠0`, Verliererposition `N=0`).
- `architecture.md` → §2.1 (`nim.js` liefert `nimSum`, `legalZug`, `optimalerZug`).

## Ausgangszustand (Code, den du vorfindest)
- `nim.js` enthält bereits (aus Task 02 + 03):
  - `window.Nim = window.Nim || {};`
  - `Nim.parseAllowed(rule, ownList)`
  - `Nim.legalAmount(rule, A, amount, heapSize)`
  - `Nim.grundyTable(maxStone, A)`
- Du **erweiterst** `nim.js` um die vier Funktionen unten. Danach ist `nim.js`
  **fertig** — die KI (Task 05–07) baut darauf auf.

## Ziel
In `nim.js` (unter `window.Nim`) implementieren:

### `Nim.nimSum(position, A)` → Zahl
- `position` = Array der Haufengrößen `[n1, n2, …]`.
- `A` = erlaubte Mengen (`null` = Klassisch, Array = Listen-Modi) aus Task 02.
- Berechnet `g` über `Nim.grundyTable` (max = `Math.max(...position)`),
  gibt die **XOR** über alle `g(n_i)` zurück.

### `Nim.isLegal(position, A, heapIdx, amount)` → `boolean`
- `heapIdx` ist der **0-basierte** Index in `position`.
- Legal genau dann, wenn:
  - `0 ≤ heapIdx < position.length`
  - `position[heapIdx] >= 1`
  - `Nim.legalAmount(<regel passend zu A>, A, amount, position[heapIdx])` ist `true`
    (regle das über die `rule`-Parameter; du kannst `rule` zusätzlich übergeben oder
    intern aus `A` herleiten — **doku­mentiere** in einem kurzen Kommentar, was du tust).

### `Nim.optimalMove(position, A)` → `{ heapIdx, amount }` oder `null`
- Falls `nimSum === 0` → **`null`** (Verliererposition, kein Gewinnzug).
- Falls `nimSum ≠ 0`:
  - Für jeden Haufen `i`: `target_i = N XOR g(n_i)`.
  - Wähle **einen** Haufen `i` und eine Menge `a ∈ A` (bzw. `1..n_i` bei Klassisch)
    mit `a ≤ n_i` und `g(n_i - a) === target_i`. Nach dem NIM-Strategie-Theorem
    existiert mindestens ein solcher Zug.
  - Gib `{ heapIdx: i, amount: a }` zurück. (Beliebige gültige Wahl ist okay.)

### `Nim.randomLegal(position, A)` → `{ heapIdx, amount }`
- **Zufälliger** legaler Zug: wähle einen Haufen mit `n_i ≥ 1` zufällig, dann eine
  Menge `a` zufällig aus den legalen Mengen für diesen Haufen.
- Zufall über `window.crypto.getRandomValues` (s. `architecture.md §3.1`).
- Vorraussetzung: Es existiert mindestens ein legaler Zug (sonst Spielende).

## Relevante Vorgaben (Zusammenfassung)
- NIM-Summe `N = g(n1) XOR g(n2) XOR …`. Stellung ist **gewinnbar** genau dann
  wenn `N ≠ 0`. → `req §4.1`.
- Optimaler Zug (wenn `N≠0`): Haufen `i` und `a` so, dass `g(n_i - a) = N XOR g(n_i)`;
  danach ist die NIM-Summe `0`. → `req §4.1`.
- Verliererposition (`N=0`): **kein** Gewinnzug; KI fällt später auf Heuristik zurück
  (in `ai.js`). → `req §4.2`, `req §4.1`.
- Deterministische Teile der Logik; nur `randomLegal` darf Zufall nutzen.
  → `arch §3.1`.

## Umsetzungshinweise
- Cache die Grundy-Tabelle (Task 03) pro `(A, max)` erneut verwenden, damit
  `nimSum`, `optimalMove` und `randomLegal` nicht jedes Mal neu rechnen.
- Bei `optimalMove`: Iteriere über Haufen, dann über mögliche Mengen; die
  erste gültige Kombination reicht. Bei Klassisch iteriere `a` von 1..n_i.
- Bei `randomLegal`: Sammle zuerst die Liste aller legalen `(heapIdx, a)`-Paare,
  wähle dann ein zufälliges Index-Paar.
- Alle Funktionen **rein** (keine DOM-Bezüge).

## Abnahmekriterien (überprüfbar – Konsole)
- [ ] `Nim.nimSum([10,7,3], null)` → `10^7^3 = 14` (Klassisch, `g(n)=n`).
- [ ] `Nim.nimSum([5,5], [1,2,3,4])` → `0` (`5%5=0`, `0 XOR 0 = 0`).
- [ ] `Nim.optimalMove([10,7,3], null)` → ein legaler Zug, für den danach
      `Nim.nimSum(apply(position, move), null) === 0`.
- [ ] `Nim.optimalMove([1,1], null)` → `null` (`1^1=0`).
- [ ] `Nim.optimalMove([2,2], [1,2,3,4])` → `null` (`2%5=2`, `2^2=0`).
- [ ] `Nim.optimalMove([2,3], [1,2,3,4])` → legaler Zug, danach NIM-Summe `0`.
- [ ] `Nim.isLegal([5], null, 0, 3)` → `true`; `Nim.isLegal([5], [1,2,3,4], 0, 5)` → `false`.
- [ ] `Nim.randomLegal([3,2], [1,2,3,4])` → immer ein legaler Zug (100× Aufruf: alle legal).
- [ ] Keine Konsolenfehler; alle Task-02/03 Funktionen sind weiterhin intakt.

## Definition of Done
`nim.js` ist **fertig**: Es liefert `parseAllowed`, `legalAmount`, `grundyTable`,
`nimSum`, `isLegal`, `optimalMove`, `randomLegal` — alle rein, alle per Konsole
testbar, alle korrekt für die drei Zugregeln.
