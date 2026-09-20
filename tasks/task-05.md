# Task 05 – `ai.js`: Baxi (immer optimal)

> **Wichtig für dich (KI):** Lies vor Beginn **`architecture.md`** §2.1 und
> **`requirements.md`** §4.2 (Baxi) und §4.1 (Modell). Diese Datei ist
> **selbsterklärend**: Du brauchst nur sie, die zwei Docs und den unten
> beschriebenen **Codestand** — **keine anderen Task-Dateien** lesen.

## Lies zuerst

- `requirements.md` → §4.2 (Baxi) und §4.1 (Grundy-Modell, optimaler Zug).
- `architecture.md` → §2.1 (`ai.js` verwendet **nur** `nim.js`, keine eigene Grundy-Logik).

## Ausgangszustand (Code, den du vorfindest)

- `nim.js` ist **fertig** (Task 01–04) und liefert unter `window.Nim`:
  `parseAllowed`, `legalAmount`, `grundyTable`, `nimSum`, `isLegal`, `optimalMove`,
  `randomLegal`.
- `ai.js` existiert und enthält (aktuell) nur:
  ```js
  window.AI = window.AI || {};
  ```
- Du **erweiterst** `ai.js`. `game.js` bleibt noch Platzhalter.

## Ziel

In `ai.js` (unter `window.AI`) die öffentliche Schnittstelle und Baxi anbinden:

### `AI.chooseMove(position, A, who)` → `{ heapIdx, amount }`

- `position` = Haufengrößen-Array, `A` = erlaubte Mengen (aus `nim.js`),
  `who` = Charakter-Name (`"Baxi"`, später `"Ducola"`/`"Muisa"`).
- Für **`"Baxi"`**:
  - Wenn `Nim.nimSum(position, A) !== 0` → `Nim.optimalMove(position, A)`.
  - Wenn `Nim.nimSum(position, A) === 0` (Verliererposition) → **`1` aus dem
    größten Haufen**: wähle den Haufen mit der größten Größe (bei Gleichstand:
    beliebigen der größten), `amount = 1`.
- Für noch unbekannte `who`: wirf einen klaren Fehler (spätere Tasks ergänzen).

## Relevante Vorgaben (Zusammenfassung)

- **Baxi** spielt **immer optimal**: `N≠0` → NIM-Summe auf 0 zwingen;
  `N=0` → **kleinstmögliche Menge (= `1`, da `1 ∈ A`) aus dem größten Haufen**.
  → `req §4.2`.
- `ai.js` nutzt **nur** `nim.js`, hat keine eigene Grundy-Berechnung,
  keine DOM-/UI-Bezüge. → `arch §2.1`.
- „Gesamtsteinanzahl" = Summe aller Haufen in der aktuellen Stellung (braucht
  Baxi **nicht**, dient Ducola/Muisa). → `req §4`.

## Umsetzungshinweise

- Kapsel die Grundy-/NIM-Aufrufe hinter `nim.js` — `ai.js` muss `g`/`mex` **nicht**
  selbst kennen.
- „Größter Haufen": bei mehreren gleich großen Haufen ist jede Wahl zulässig.
- `AI.chooseMove` ist der **einzige** öffentliche Aufruf, den `game.js` später braucht.

## Abnahmekriterien (überprüfbar – Konsole)

- [ ] `AI.chooseMove([10,7,3], null, "Baxi")` → legaler Zug, für den danach
      `Nim.nimSum(apply(...), null) === 0`.
- [ ] `AI.chooseMove([1,1,5], null, "Baxi")` (N = `1^1^5 = 5`) → legal, danach NIM-Summe `0`.
- [ ] Verliererposition `[3,3]` (N=0): `AI.chooseMove([3,3], null, "Baxi")` →
      `amount === 1`, `heapIdx` zeigt auf einen der (beiden) größten Haufen.
- [ ] `[2,2]` mit `A=[1,2,3,4]` (N=0): → `amount === 1`.
- [ ] Alle drei Regeln: Baxi-Zug ist in jedem Fall **legal**
      (`Nim.isLegal` → `true`).
- [ ] Keine Konsolenfehler; `nim.js`-Funktionen unverändert.

## Definition of Done

`AI.chooseMove` ist vorhanden, Baxi verhält sich exakt wie `req §4.2`
(optimal bei Gewinnposition, `1` aus größtem Haufen bei Verliererposition),
und `ai.js` bleibt DOM-frei und abhängig **nur** von `nim.js`.
