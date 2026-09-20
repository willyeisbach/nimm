# Task 01 – Datei- & Skript-Gerüst (läuft per `file://`)

> **Wichtig für dich (KI):** Lies vor Beginn **`architecture.md`** (v. a. §1.2, §2, §3.1, §3.4)
> und **`requirements.md`** §1 und §7. Diese Datei ist **selbsterklärend**: Du brauchst
> nur sie, die zwei Docs und den unten beschriebenen **Codestand** — **keine anderen
> Task-Dateien** lesen.

## Lies zuerst

- `architecture.md` → §1.2 (keine ES-Module), §2 (Dateistruktur), §3.1 (JS-Regeln), §3.4 (Einstiegspunkt, Skript-Reihenfolge).
- `requirements.md` → §1 (Ziel), §7 (lokale Ausführung – **hart**).

## Ausgangszustand (Code, den du vorfindest)

Im Projektordner existieren **nur** Dokumente, noch **keine** Code-Dateien:

```
nimm/
├─ architecture.md
├─ initial-prompt.txt
├─ requirements.md
└─ tasks/
```

Du legst in **diesem Projektordner** die fünf Code-Dateien neu an.

## Ziel

Lege die 5 Dateien an und verdrahte sie so, dass `index.html` per Doppelklick in
einem aktuellen Browser läuft — **ohne** leere Seite, **ohne** rote Konsolenfehler.

1. **`index.html`**
   - `<head>`: `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<link rel="stylesheet" href="style.css">`.
   - `<body>`: nur statisches **Skelett-Markup** der Hülle:
     - Kopfzeile mit Titel + **Options-Zahnrad** (Button, oben rechts, `id` vorhanden).
     - Container für die Haufen (`id="heaps"`), noch leer.
     - Status-Block: „Aktiver Spieler" + „Letzter Zug" (`id`s vorhanden).
     - Eingabe-Bereich: Haufen-Auswahl-Hinweis, `<input>` „Steine zu nehmen", Button **„Ziehen"**.
     - Sieg-Overlay (`id="win-overlay"`), initial mit `hidden`.
   - Am **Ende** des `<body>`, in genau dieser Reihenfolge, **ohne** `type="module"`:
     ```html
     <script src="nim.js"></script>
     <script src="ai.js"></script>
     <script src="game.js"></script>
     ```
   - **Kein** Inline-JS (nur `<script src>`), **kein** Inline-CSS.
2. **`style.css`**: leeres/minimales Grundstyling (z. B. `body`-Margin, System-Font-Stack). Kein CSS-Preprocessor.
3. **`nim.js`**: legt nur den globalen Anker an → `window.Nim = window.Nim || {};` (leer/Platzhalter).
4. **`ai.js`**: legt `window.AI = window.AI || {};` an.
5. **`game.js`**: legt `window.Game = window.Game || {};` an. (Noch keine Logik.)

## Relevante Vorgaben (Zusammenfassung, damit du die Docs nicht erneut durchforsten musst)

- **Kein `import`/`export`**, kein `<script type="module">` — Chromium/Edge lehnen
  ES-Module unter `file://` wegen CORS ab (sonst leere Seite). → `architecture.md §1.2`.
- **Kein** Build, **kein** npm/Node, **keine** externen Abhängigkeiten/CDN/Web-Fonts,
  **kein** Netzwerk. → `requirements.md §7`, `architecture.md §1.1/§3.1`.
- Gemeinsamer globaler Namespace über `window.Nim` / `window.AI` / `window.Game`;
  Reihenfolge der `<script>`-Tags bestimmt Verfügbarkeit. → `architecture.md §3.1/§3.4`.
- JS auf **ES2020** (arrow, `const`/`let`, `?.`, `??`); nichts Neues (kein `import.meta`,
  keine top-level `await`). → `architecture.md §3.1`.

## Umsetzungshinweise

- Alles muss per **Doppelklick** (`file://`) unter Windows/macOS/Linux laufen.
- Halte `index.html` bewusst klein — die eigentliche Logik kommt in späteren Tasks.
- Verwende sinnvolle, stabile `id`s, da spätere Tasks darauf aufbauen
  (`heaps`, `win-overlay`, Options-Zahnrad, Input, Button „Ziehen", Status-Block).

## Abnahmekriterien (überprüfbar)

- [ ] `index.html` öffnet per **Doppelklick** (Win/mac/Linux) ohne leere Seite und
      **ohne** rote Konsolenfehler.
- [ ] `grep -n 'type="module"\|import \|export ' index.html nim.js ai.js game.js` → **keine** Treffer.
- [ ] DevTools → Network: nach Load **keine** externen Requests.
- [ ] Konsole: `typeof window.Nim` → `"object"`; `typeof window.AI` → `"object"`;
      `typeof window.Game` → `"object"`.
- [ ] Sichtprüfung: Titel, Zahnrad (oben rechts), Haufen-Container, Status-Block,
      Eingabe-Feld + „Ziehen"-Button, (verstecktes) Sieg-Overlay sind vorhanden.

## Definition of Done

Fünf Dateien existieren, `index.html` läuft `file://`-tauglich, globale Anker sind
gesetzt, und kein einziges `import`/`export`/`module`-Artefakt ist vorhanden.
