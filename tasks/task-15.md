# Task 15 – Veredelung: Barrierefreiheit, Responsive, Fehler-Hygiene

> **Wichtig für dich (KI):** Lies vor Beginn **`architecture.md`** §3.5, §3.6, §3.7
> und **`requirements.md`** §7.2. Diese Datei ist **selbsterklärend**: Du brauchst
> nur sie, die zwei Docs und den unten beschriebenen **Codestand** —
> **keine andere Task-Datei** lesen.

## Lies zuerst
- `architecture.md` → §3.5 (Responsive/Mobile), §3.6 (Barrierefreiheit), §3.7 (Edge-Case-Tabelle), §3.1 (console-Hygiene).
- `requirements.md` → §7.2 (nur `console.error`), §7.1 (keine Build-Tools, ES2020).

## Ausgangszustand (Code, den du vorfindest)
- Alle `index.html`, `style.css`, `nim.js`, `ai.js`, `game.js` sind **funktional**
  (Tasks 01–14): Spiel läuft E2E, KI zieht, Options-Dialog funktioniert, Sieg-Overlay.
- Du **prüfst und vervollständigst** die Punkte unten (neue Funktionen optional,
  Bestehendes anpassen).

## Ziel
1. **Barrierefreiheit** (Vollzug `arch §3.6`):
   - Alle interaktiven Elemente (Haufen, Input, Button, Zahnrad, Dialog-Buttons,
     Overlay-Button) sind per **Tab** erreichbar (`tabindex="0"` wo nötig).
   - `<label for="…">` auf **jedem** Input-Feld (auch im Options-Dialog).
   - `aria-live="polite"` auf Aktiver-Spieler/Letzter-Zug-Block (sollte in Task 09
     gesetzt sein — prüfen).
   - `aria-invalid` bei ungültigen Feldern (sollte in Task 13 gesetzt sein — prüfen).
   - `aria-disabled`-Status wo sinnvoll.
2. **Responsive / Mobile** (`arch §3.5`):
   - `@media (max-width: 600px)`: größere Touch-Ziele, Stapel-Layout statt
     Nebeneinander.
   - Haufen-Container `flex-wrap: wrap`; kein Seitwärts-Überlauf bei 320 px.
3. **Fehler-Hygiene** (`req §7.2`, `arch §3.7`):
   - **Kein** `console.log`/`console.warn` Spam — nur **`console.error`** bei
     tatsächlichen Fehlern.
   - Kritische Pfade (KI-Entscheidung, Render, `crypto`) haben **try/catch**, die
     `console.error` loggen und nicht abcrashen.
   - Edge-Cases der `arch §3.7`-Tabelle sind abgedeckt:
     - leeres/leer-gelassenes Input → Button inaktiv (Task 10).
     - `maxHaufen=1` → Auswahl automatisch (Task 10).
     - unendliche Schleife bei KI-beide — defensive Abfrage in `maybeAIMove` (Task 14).
     - ungültige „Eigene Liste" → validiert (Task 13).

## Relevante Vorgaben (Zusammenfassung)
- **Kein** `console.log`/`warn` Spam; nur `console.error` bei echten Fehlern. → `req §7.2`, `arch §3.7`.
- `aria-live`, `aria-invalid`, Labels, `tabindex`, `aria-disabled` → `arch §3.6`.
- `@media (max-width: 600px)`: größere Touch-Ziele, Stapel-Layout. → `arch §3.5`.
- Edge-Case-Tabelle vollständig abgedeckt. → `arch §3.7`.
- ES2020, **keine** ES-Module, **keine** Build-Tools. → `req §7.1`.

## Umsetzungshinweise
- **Nicht** neu bauen — bestehende Komponenten prüfen und gezielt Lücken schließen.
- `console.*`-Aufrufe: `grep -rn "console.log\|console.warn"` → alle auf
  `console.error` umstellen oder entfernen (nur echte Fehler bleiben).
- Touch-Ziele: `min-height: 44px` auf Buttons/Haufen in Mobile-Breakpoint.
- `aria-disabled` ist ein **Presentation-Attribute** — setze es neben
  `disabled`-Attribute, wo du Button-States verwaltest.

## Abnahmekriterien (überprüfbar)
- [ ] **Tab-Order** läuft durch: Haufen → Input → Button → Zahnrad → (Dialog) →
      (Overlay) — ohne „Tab-Traps".
- [ ] Jeder Input hat ein `for`-Label; Screenreader kann jedes Feld benennen.
- [ ] `grep -rn "console.log\|console.warn" *.js` → **keine Treffer** (nur `console.error`).
- [ ] 320 px / 375 px / 768 px / 1440 px: kein Überlauf, Touch-Ziele ≥ 44 px
      (mobile), Lesbarkeit gegeben.
- [ ] Edge-Cases (leeres Input, 1 Haufen, ungültige Liste, KI-beide) alle
      reproduzierbar getestet → keine Crashes, klare Fehlerbehandlung.
- [ ] `grep -rn 'type="module"\|\bimport \b\|\bexport \b|fetch(|cdn\.\|@import' index.html *.css *.js`
      → **keine Treffer**.
- [ ] Keine Konsolenfehler im **gesamten** Spielverlauf.

## Definition of Done
Barrierefreiheit (Labels, `aria-*`, Tastatur), Responsive (Mobile-Layout,
Touch-Ziele), Fehler-Hygiene (nur `console.error`, try/catch, Edge-Cases) sind
vollständig — das Spiel ist für die finale Acceptance (Task 16) bereit.
