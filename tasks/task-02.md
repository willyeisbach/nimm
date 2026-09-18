# Task 02 – `nim.js`: Zugregel-Parser & erlaubte Mengen

> **Wichtig für dich (KI):** Lies vor Beginn **`architecture.md`** §2.1/§3.1 und
> **`requirements.md`** §3.2 und §6. Diese Datei ist **selbsterklärend**: Du brauchst
> nur sie, die zwei Docs und den unten beschriebenen **Codestand** — **keine anderen
> Task-Dateien** lesen.

## Lies zuerst
- `requirements.md` → §3.2 (Zugregeln: Klassisch / 4er-Nimm / Eigene Liste) und §6 (Validierung „Zug (Eingabe)").
- `architecture.md` → §2.1 (Zuständigkeit `nim.js`), §3.1 (JS-Regeln).

## Ausgangszustand (Code, den du vorfindest)
- Task 01 ist erledigt: `index.html` lädt `nim.js → ai.js → game.js` am Ende des
  `<body>`, `style.css` ist verlinkt.
- `nim.js` existiert und enthält (aktuell) nur:
  ```js
  window.Nim = window.Nim || {};
  ```
  Du **erweiterst** `nim.js` um die Funktionen unten. `ai.js`/`game.js` bleiben
  Platzhalter. `nim.js` hat **keine** DOM-/UI-Abhängigkeiten.

## Ziel
In `nim.js` (unter `window.Nim`) zwei Funktionen implementieren:

### `Nim.parseAllowed(rule, ownList)` → erlaubte Mengen `A`
Ergibt die **aufsteigend sortierte**, **deduplizierte** Liste erlaubter Nehm-Mengen:
- `rule === "classic"` → **`null`** als Sonderwert (= „jede Menge 1..Haufengröße").
- `rule === "4er"` → `[1, 2, 3, 4]`.
- `rule === "own"` → `ownList` ist ein **Kommazahlen**-String (z. B. `"1,3,5"`):
  - Alle Einträge müssen **positive Ganzzahlen ≥ 1** sein.
  - **`1` muss enthalten sein**, sonst **ungültig**.
  - Duplikate entfernen, **aufsteigend** sortieren.
  - Ungültig (leer, nicht-numerisch, negatives/0, fehlendes `1`) → **`null`** (oder
    werfe; `game.js` wird das später abfangen — s. `architecture.md §3.7`).
- Unbekannte `rule` → `null`.

### `Nim.legalAmount(rule, A, amount, heapSize)` → `boolean`
Gibt an, ob eine Menge `amount` aus einem Haufen der Größe `heapSize` legal ist:
- `amount` muss **positive Ganzzahl ≥ 1** sein.
- `amount ≤ heapSize`.
- Klassisch (`A === null`): zusätzlich **immer** erlaubt (da `≤ heapSize` reicht).
- Listen-Modi (`A` ist Array): zusätzlich **`amount ∈ A`**.

## Relevante Vorgaben (Zusammenfassung)
- **Klassisch:** beliebig viele (1 bis zur Haufengröße). → `req §3.2` Punkt 1.
- **4er-Nimm:** exakt `{1,2,3,4}`. → `req §3.2` Punkt 2.
- **Eigene Liste:** positive Ganzzahlen, **`1` enthalten**, Duplikate raus, sortiert;
  ungültig → Fehler, nicht übernehmen. → `req §3.2` Punkt 3.
- Zug-Validierung: `≥ 1`, in erlaubter Menge, `≤` Ziel-Haufen-Größe. → `req §5.3`, `req §6`.
- `nim.js` bleibt **rein** (keine DOM/UI), ES2020, keine Module. → `arch §2.1`, `arch §3.1`.

## Umsetzungshinweise
- Helper zum Parsen der `own`-Liste intern halten; nur `parseAllowed` und
  `legalAmount` (plus ggf. interne Helfer) unter `window.Nim` exponieren.
- Für Klassisch `A === null` konsistent nutzen — spätere Tasks (Grundy/KI)
  verlassen sich auf dieses Signal.
- Deterministisch; kein Zufall.

## Abnahmekriterien (überprüfbar – Konsole)
- [ ] `Nim.parseAllowed("classic")` → `null`.
- [ ] `Nim.parseAllowed("4er")` → `[1,2,3,4]`.
- [ ] `Nim.parseAllowed("own","1,3,5")` → `[1,3,5]`.
- [ ] `Nim.parseAllowed("own","3,3,1,2")` → `[1,2,3]` (Dedupe + Sort).
- [ ] `Nim.parseAllowed("own","2,4,7")` → `null` (kein `1`).
- [ ] `Nim.parseAllowed("own","0,1,2")` → `null` (0 ist keine positive Ganzzahl).
- [ ] `Nim.parseAllowed("own","")` → `null`.
- [ ] `Nim.legalAmount("classic", null, 7, 7)` → `true`; `(…,8,7)` → `false`.
- [ ] `Nim.legalAmount("4er", [1,2,3,4], 4, 10)` → `true`; `(…,5,10)` → `false`.
- [ ] `Nim.legalAmount("own", [1,3,5], 3, 5)` → `true`; `(…,2,5)` → `false`; `(…,5,4)` → `false`.
- [ ] Keine Konsolenfehler; `nim.js` referenziert `document`/`window`-DOM **nicht**.

## Definition of Done
`Nim.parseAllowed` und `Nim.legalAmount` sind vorhanden, decken alle drei Regeln ab,
und die obigen Konsolen-Tests geben erwartete Werte.
