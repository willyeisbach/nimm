# Task 06 – `ai.js`: Ducola (großzügig früh, optimal spät)

> **Wichtig für dich (KI):** Lies vor Beginn **`architecture.md`** §2.1 und
> **`requirements.md`** §4.3 (Ducola) und §4.1 (Modell). Diese Datei ist
> **selbsterklärend**: Du brauchst nur sie, die zwei Docs und den unten
> beschriebenen **Codestand** — **keine anderen Task-Dateien** lesen.

## Lies zuerst

- `requirements.md` → §4.3 (Ducola) und §4.1 (NIM-Summe, Optimaler Zug).
- `architecture.md` → §2.1 (`ai.js` nutzt nur `nim.js`).

## Ausgangszustand (Code, den du vorfindest)

- `nim.js` ist **fertig** und liefert (u. a.) `nimSum`, `optimalMove`, `randomLegal`,
  `isLegal`, `legalAmount`, `grundyTable`.
- `ai.js` enthält bereits (aus Task 05):
  - `window.AI = window.AI || {};`
  - `AI.chooseMove(position, A, who)` — behandelt **`"Baxi"`** korrekt;
    für andere `who` wirft er aktuell einen Fehler.
- Du **erweiterst** `AI.chooseMove` um den Fall `who === "Ducola"`.

## Ziel

Im `AI.chooseMove`-Dispatch den Zweig **`"Ducola"`** ergänzen:

- **Gesamtsteinanzahl `S = sum(position)`**:
  - **`S > 10`** („früh"): Wähle einen **legalen** Zug, nach dem die neue
    NIM-Summe `N' !== 0` ist (lässt dem Gegner eine Gewinnposition).
    - Wähle **zufällig** unter allen legalen Zügen mit `N' !== 0`.
    - **Falls kein** legaler Zug `N' !== 0` ergibt (alle `N'=0`) →
      `Nim.randomLegal(position, A)`.
  - **`S ≤ 10`** („spät"): wie **Baxi** — `Nim.optimalMove` bei `N≠0`,
    sonst `1` aus größtem Haufen.

## Relevante Vorgaben (Zusammenfassung)

- Ducola: **> 10 Steine** → legaler Zug, der dem Gegner **falls möglich** eine
  Gewinnposition (`N' ≠ 0`) lässt; sonst (≤ 10) **optimal wie Baxi**.
  → `req §4.3`.
- „Gesamtsteinanzahl" = Summe aller Haufen in der aktuellen Stellung.
  → `req §4`, `req §9`.
- Fallback: wenn kein Zug `N'≠0` bringt → **zufälliger legaler Zug**. → `req §4.3`, `req §9`.
- `ai.js` nutzt **nur** `nim.js`. → `arch §2.1`.

## Umsetzungshinweise

- Helper: `applyMove(position, move)` → neue `position` (intern in `ai.js`),
  um `N'` zu berechnen.
- „Alle legalen Züge sammeln": über alle Haufen `i` mit `n_i ≥ 1` und alle
  `a` mit `Nim.legalAmount(...)`, berechne `N'` für den jeweiligen Zug,
  filter auf `N' !== 0`.
- `Nim.randomLegal` ist für den Fallback bereits in `nim.js` vorhanden (Task 04).
- Wiederverwende die Baxi-Logik im `S ≤ 10`-Zweig (Faktorisierung optional).

## Abnahmekriterien (überprüfbar – Konsole)

- [ ] **Früh (S > 10)**: `AI.chooseMove([10,7,3], null, "Ducola")` → legaler Zug,
      nach dem **`Nim.nimSum(apply(...), null) !== 0`** (solange ein solcher
      Zug existiert — für diese Position ja).
- [ ] **Spät (S ≤ 10)**: `AI.chooseMove([3,2], null, "Ducola")` → wie Baxi:
      bei `N≠0` optimal (danach NIM-Summe `0`), bei `N=0` `1` aus größtem Haufen.
- [ ] **Fallback** (S > 10, alle legalen Züge `N'=0`): ergibt einen **legalen**
      Zug. _(Konstruktion: z. B. `position=[1,0,0]` mit `A=[1]` — dann ist
      der einzige legale Zug `[0,0,0]`, NIM-Summe 0. → `AI.chooseMove` liefert
      genau diesen Zug, nicht `null`.)_
- [ ] Alle drei Regeln: Ducola-Zug ist in jedem Fall **legal**.
- [ ] Keine Konsolenfehler; Baxi-Zweig (Task 05) ist weiterhin korrekt.

## Definition of Done

`AI.chooseMove(…, "Ducola")` deckt alle drei Fälle ab (Früh mit `N'≠0`,
Fallback, Spät wie Baxi) und bleibt DOM-frei.
