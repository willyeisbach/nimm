# Task 07 – `ai.js`: Muisa (zufällig früh, optimal spät)

> **Wichtig für dich (KI):** Lies vor Beginn **`architecture.md`** §2.1 und
> **`requirements.md`** §4.4 (Muisa) und §4.1 (Modell). Diese Datei ist
> **selbsterklärend**: Du brauchst nur sie, die zwei Docs und den unten
> beschriebenen **Codestand** — **keine anderen Task-Dateien** lesen.

## Lies zuerst
- `requirements.md` → §4.4 (Muisa) und §4.1 (Optimaler Zug / Verliererposition).
- `architecture.md` → §2.1 (`ai.js` nutzt nur `nim.js`).

## Ausgangszustand (Code, den du vorfindest)
- `nim.js` ist **fertig**.
- `ai.js` enthält bereits (aus Task 05 + 06):
  - `AI.chooseMove(position, A, who)` — behandelt **"Baxi"** und **"Ducola"**
    korrekt; für andere `who` wirft er aktuell einen Fehler.
- Du **erweiterst** `AI.chooseMove` um den Fall `who === "Muisa"`.

## Ziel
Im `AI.chooseMove`-Dispatch den Zweig **`"Muisa"`** ergänzen:

- **Gesamtsteinanzahl `S = sum(position)`**:
  - **`S > 5`** („früh"): `Nim.randomLegal(position, A)` — **zufälliger**
    legaler Zug.
  - **`S ≤ 5`** („spät"): wie **Baxi** — `Nim.optimalMove` bei `N≠0`,
    sonst `1` aus größtem Haufen.

## Relevante Vorgaben (Zusammenfassung)
- Muisa: **> 5 Steine** → **zufälliger** legaler Zug; **≤ 5 Steine** →
  **optimal wie Baxi**. → `req §4.4`.
- „Gesamtsteinanzahl" = Summe aller Haufen in der aktuellen Stellung.
  → `req §4`, `req §9`.
- `ai.js` nutzt **nur** `nim.js`; `randomLegal` kommt aus Task 04. → `arch §2.1`.

## Umsetzungshinweise
- Kapsel die „wie Baxi"-Logik (Spät-Zweig) am besten in einem kleinen internen
  Helper (`optimalOrFallback`), damit Ducola und Muisa denselben Code nutzen.
- „Zufälliger legaler Zug" nutzt `Nim.randomLegal`, der bereits
  `window.crypto.getRandomValues` für den Zufall verwendet.
- Nach dem Muisa-Zweig: `AI.chooseMove` behandelt **alle drei** Charaktere;
  ein unbekannter `who` wirft weiterhin einen klaren Fehler.

## Abnahmekriterien (überprüfbar – Konsole)
- [ ] **Früh (S > 5)**: `AI.chooseMove([3,3], null, "Muisa")` → legaler Zug;
      mehrere Aufrufe liefern i. d. R. **unterschiedliche** `(heapIdx, amount)`
      → Zufall greift (nicht deterministisch optimal).
- [ ] **Spät (S ≤ 5)**: `AI.chooseMove([2,1], null, "Muisa")` → wie Baxi
      (bei `N≠0` optimal, bei `N=0` `1` aus größtem Haufen).
- [ ] `[1,1]` (S=2, N=0): → `amount === 1`, Haufen einer der beiden (beide
      gleich groß).
- [ ] Alle drei Regeln: Muisa-Zug ist in jedem Fall **legal**.
- [ ] **Alle drei Charaktere** funktionieren jetzt: `AI.chooseMove(…, "Baxi")`,
      `("Ducola")`, `("Muisa")` — keine der drei wirft mehr einen Fehler.
- [ ] Unbekannter `who` (z. B. `"Foo"`) → wirft/clares ein klares
      `Error`/`console.error`-Message.
- [ ] Keine Konsolenfehler; `nim.js`-Funktionen unverändert.

## Definition of Done
`AI.chooseMove` behandelt **alle drei** Charaktere gemäß `req §4.2–4.4`,
`ai.js` bleibt DOM-frei und abhängig **nur** von `nim.js`.
