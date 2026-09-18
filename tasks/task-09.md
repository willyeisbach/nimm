# Task 09 – `game.js`: Rendering (Haufen, Steine, Status)

> **Wichtig für dich (KI):** Lies vor Beginn **`architecture.md`** §2.1, §3.2, §3.6
> und **`requirements.md`** §5.1 und §5.4. Diese Datei ist **selbsterklärend**:
> Du brauchst nur sie, die zwei Docs und den unten beschriebenen **Codestand** —
> **keine anderen Task-Dateien** lesen.

## Lies zuerst
- `requirements.md` → §5.1 (Hauptbildschirm/Layout, Aktiver Spieler, Letzter Zug) und §5.4.
- `architecture.md` → §3.2 (DOM & Rendering), §3.6 (Barrierefreiheit minimal), §3.5 (CSS).

## Ausgangszustand (Code, den du vorfindest)
- `index.html` enthält das Skelett-Markup (Haufen-Container `#heaps`,
  Status-Block mit „Aktiver Spieler" + „Letzter Zug", Input, Button, Zahnrad, Overlay).
- `game.js` enthält bereits (aus Task 08): `Game.state`, `Game.defaults`,
  `Game.newHeaps`, `Game.start()`.
- `style.css` hat Grundstyling.
- Du **erweiterst** `game.js` um `Game.render()`.

## Ziel
In `game.js` implementieren:

### `Game.render()`
Rendert den aktuellen `Game.state` in das vorhandene DOM:
1. **Haufen**: Für jeden Haufen in `Game.state.heaps`:
   - Ein `<div class="heap">` mit Beschriftung „Haufen `i+1`" und der Anzahl.
   - Innerhalb: `n`-mal ein `<span class="stone">` (ein Stein = ein sichtbarer
     Kreis/Punkt). `i` ist 0-basiert im Zustand, Anzeige 1-basiert.
   - Der Container wird **geleert und neu gefüllt** (kein diff-basiertes Rendering).
2. **Status-Block**:
   - „Aktiver Spieler" zeigt den **Namen** des aktiven Spielers
     (aus `Game.state.name1`/`name2` je nach `Game.state.active`).
   - „Letzter Zug" zeigt
     - `„–"`, wenn `Game.state.lastMove === null`,
     - sonst: `"<Name> hat <amount> aus Haufen <heapIdx+1> genommen"`.
   - Das Status-Block-Element hat **`aria-live="polite"`**.
3. `render()` wird nach `start()` (Task 08) aufgerufen; später auch nach Zügen.

## Relevante Vorgaben (Zusammenfassung)
- Haufen als `<div class="heap">` mit N-`<span class="stone">`; Beschriftung
  „Haufen i" + Anzahl; bei „Neues Spiel" Container leeren & neu füllen.
  → `arch §3.2`.
- Aktiver Spieler **deutlich sichtbar** (Name + ggf. Rolle); Letzter Zug:
  `<Name> hat <n> aus Haufen <i> genommen` (vorab „–"). → `req §5.1`, `req §5.4`.
- `aria-live="polite"` auf dem Aktiver-Spieler/Letzter-Zug-Block. → `arch §3.6`.
- Kein Virtual DOM, keine Template-Systeme — direkte DOM-Manipulation
  (`querySelector`, `textContent`). → `arch §3.2`.

## Umsetzungshinweise
- Nutze `element.textContent`/`innerHTML` bewusst; Steine als einfache Spans.
- Bereite eine stabile Struktur vor, die Task 10 (Auswahl-Highlight) und
  Task 11 (Blink) wiederverwenden können — z. B. `data-heap-index` auf jedem
  `.heap`-Element.
- Responsiv: Haufen in einer Flex-Box mit `flex-wrap: wrap` (s. `arch §3.5`);
  ggf. ein wenig CSS in `style.css` ergänzen (`.heap`, `.stone`).

## Abnahmekriterien (überprüfbar – Sichtprüfung)
- [ ] Nach `Game.start()` (Defaults): genau **1** `.heap` im DOM, mit **10–20**
      `.stone`-Spans und Beschriftung „Haufen 1" + korrekter Anzahl.
- [ ] Temporär 3 Haufen (Konfiguration gesetzt, `start()`): **3** `.heap`,
      jeweils korrekte Stein-Anzahl + Beschriftung.
- [ ] Status zeigt den Namen des aktiven Spielers; „Letzter Zug" = „–".
- [ ] `aria-live="polite"` ist auf dem Status-Block gesetzt
      (`document.querySelector('#status').getAttribute('aria-live')` → `"polite"`).
- [ ] 375 px / 768 px / 1440 px: Haufen wrappen sauber, kein Überlauf.
- [ ] Keine Konsolenfehler.

## Definition of Done
`Game.render()` zeigt Haufen + Steine + Status korrekt, ist responsiv,
barrierefrei (aria-live) und bereitet stabile Hooks für Auswahl/Animation vor.
