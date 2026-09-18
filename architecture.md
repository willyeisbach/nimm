# NIM – Architektur & Umsetzungsrichtlinien

Diese Datei ist die **Lösungshälfte** des Projekts: `requirements.md` beschreibt
*was* das Spiel leisten muss (Problemraum), hier wird festgelegt *wie* es
umgesetzt wird. Der verbindliche Rahmen ist **`requirements.md` Abschnitt 7** –
lokale Ausführung ohne jede Laufzeit-Voraussetzung, plattformunabhängig, ohne
Build-Schritt und ohne externe Abhängigkeiten.

---

## 1. Technologie-Entscheidung: statisches HTML + CSS + Vanilla-JS

### 1.1 Begründung (Warum nicht etwas „Größeres")

Die Anforderung 7 hat **exakt eine** Eigenschaft, die die Technologie fast schon
vorgibt: Die ausgelieferten Dateien müssen per Doppelklick/Datei-Link im Browser
laufen, ohne dass irgendein Werkzeug dazwischenschießt.

| Kriterium (A7)          | HTML/CSS/JS-Vanilla | Framework (React, Vue, Svelte, …) | Node/Bundler-Setup |
| ----------------------- | :-----------------: | :-------------------------------: | :----------------: |
| Doppelklick läuft       |           ✅          |           ✅ (nach Build)         |          ❌         |
| Keine Laufzeit/Toolchain|          ✅           |          ✅ (nach Build)          |         ❌          |
| Build-Schritt           |           ❌          |              ✅ (erforderlich)    |    ✅ (erforderl.)  |
| Externe Abhängigkeiten  |           ❌          |        ✅ (npm-Pakete)            |       ✅ (npm)      |
| Win/mac/Linux identisch |           ✅          |                  ✅               |         ✅         |

Ein Framework wäre *nutzbar*, verletzt aber **zwei harte Anforderungen** (kein
Build-Schritt, keine externen Abhängigkeiten) – es bräuchte npm/Node,
Knotenpakete und ein Compile. Für ein zweispieler-NIM mit ~10 DOM-Elementen und
einer reinen Zustand-/Regellogik ist das Overhead ohne Mehrwert. **Entscheidung:
statistisch, vanilla, ohne Framework und ohne Build.**

### 1.2 Kritische Untergrenze: **keine ES-Module**

Der häufigste Stolperstein bei „statischem JS" ist `import`/`export`
(ES-Module). Diese werden über `file://` in **Chromium/Edge** (und teils
Firefox/Safari) wegen der **CORS-Restriction auf `file://` Origins** abgelehnt:
Der Browser liefert das modulare JS nicht, die Seite bleibt leer.

**Regel:** Das gesamte JS wird als **klassisches (nicht-modulares) Skript**
ausgeliefert, in der **Datei `index.html`** per `<script src="…">` ohne
`type="module"` eingebunden. Der Lade- und Ausführungsreihenfolge der Skripte
wird durch die Reihenfolge der `<script>`-Tags gesteuert.

Folgen:
- Kein `import` / `export` in JS-Dateien.
- Gemeinsamer globaler (bzw. `window`) Namespace – die Module teilen sich über
  explizite `window.*`-Ankerpunkte (s. 3.4).
- Die Reihenfolge der `<script src="…">` in `index.html` bestimmt die
  Verfügbarkeit der Funktionen.

---

## 2. Dateistruktur & Modul-Grenzen

```
nimm/
├─ index.html     # Markup, Layout, Options-Dialog, Sieg-Overlay, <script>-Order
├─ style.css      # Styling, Responsiveness, Blink-Animation (@keyframes blink)
├─ nim.js         # (1) Zugregel / erlaubte Mengen, (2) Grundy-Tabelle, (3) Legalität
├─ ai.js          # (4) Baxi / Ducola / Muisa (verwendet nim.js)
├─ game.js        # (5) Zustand, UI-Verdrahtung, Animation, Options, Einstieg
├─ requirements.md
└─ architecture.md
```

**Abhängigkeitsrichtung (einseitig):**
`game.js` → `ai.js` → `nim.js`
`nim.js` hat **keine** Abhängigkeiten zu anderen Projektdateien.

### 2.1 Zuständigkeiten

| Datei        | Verantwortet                                                              | Dürft nicht                                                       |
| ------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `nim.js`     | Parse/Validierung der Zugregel; Grundy-Tabelle `g[0..maxSteine]`; legalerZug(); optimalerZug(); NIM-Summe | UI, DOM, KI-Charakter, Zustand                                    |
| `ai.js`      | Baxi/Ducola/Muisa-Strategie; `chooseMove(position, allowed)`; „Denk"-Delay | Grundy-Logik (verwendet nur `nim.js`), DOM, UI                    |
| `game.js`    | Spielzustand; Rendering; Event-Listener; Animation; Options-Dialog; Sieg  | Grundy-/KI-Logik (nur Aufruf), DOM-Kreation von scratch           |
| `style.css`  | Alle Visibilität, Responsiveness, `@keyframes blink`, Sieg-Highlight     | JS-Logik                                                          |
| `index.html` | Statik-Markup, `<script>`-Reihenfolge, `<link>` zu CSS                  | Inline-JS (nur `<script src>`), Inline-CSS                         |

---

## 3. Umsetzungsrichtlinien

### 3.1 JavaScript: Vanilla, ES2020, keine Modules

- **Sprachstufe:** ES2020 (arrow functions, `const`/`let`, optional chaining
  `?.`, nullish coalescing `??`). Nicht neuer (kein `import.meta`, keine
  top-level `await`).
- **Kein `import`/`export`.** Gemeinsamer globaler Namespace; öffentliche
  Funktionen werden in `nim.js` als `window.Nim = { … }` exponiert, in `ai.js`
  als `window.AI = { … }`, in `game.js` als `window.Game = { … }`.
- **Kein Transpile, kein Babel, kein Bundler.**
- **Keine externen Bibliotheken** (kein Lodash, kein jQuery, keine
  CSS-Frameworks wie Tailwind/Bulma, keine CDN).
- **Fehlerbehandlung:** `try/catch` an Stellen, die zu sichtbaren UI-Fehlern
  führen (Options-Validierung, Zug-Validierung). Kein `console.log`-Spam,
  nur `console.error` für echte Fehler.
- **Determinismus:** Alle Zufallszogene werden über `window.crypto.getRandomValues`
  geholt (oder `Math.random()` für nicht-empfindliche Stellen wie die
  „Denk"-Delay-Variation). Für den Spielzustand gibt es **keine** Seed-
  Wiederholbarkeit (nicht gefordert).

### 3.2 DOM & Rendering

- **Kein Virtual DOM, kein Template-System.** Direkte DOM-Manipulation via
  `document.querySelector`, `addEventListener`, `textContent`.
- **Haufen-Rendering:** Für jeden Haufen ein `<div class="heap">` mit
  N-Stein-Elementen `<span class="stone">`. Bei „Neues Spiel" wird der
  Haufen-Container geleert und neu gefüllt.
- **Blink-Animation:** CSS-`@keyframes blink` (3–4 Blips, Opacitätswechsel),
  anwendbar durch `element.classList.add("blinking")`. Nach der Animationsdauer
  (CSS `animationend`-Event oder `setTimeout(800)`) werden die Steine aus dem
  DOM entfernt.
- **Zugsperrung:** `Game.lock = true` während KI-Zug / Animation; alle
  Eingabepunkte (`<input>`, Buttons, Haufen-Klicks) prüfen dieses Flag.

### 3.3 Optionen-Dialog

- `<dialog>`-Element **oder** `<div class="options">` mit `hidden`-Attribut –
  keine Framework-Modal-Bibliothek.
- **Validierung:** Beim Klick auf „Übernehmen" werden alle Felder
  synchron validiert (s. `requirements.md` 6). Bei Fehler: `title`-
  Feedback / `aria-invalid` + Fehler-`<p>` im Dialog, „Übernehmen" bleibt
  disabled.
- **Nach Übernahme:** `Game.state` wird mit den neuen Werten initialisiert,
  Haufen neu generiert, UI neu gerendert.
- **Zufälliger Beginns-Spieler:** `Math.random() < 0.5 ? 1 : 2`.

### 3.4 Einstiegspunkt

- `index.html` lädt die Skripte in dieser Reihenfolge:
  ```html
  <script src="nim.js"></script>
  <script src="ai.js"></script>
  <script src="game.js"></script>
  ```
- `game.js` am Dateiende enthält:
  ```js
  window.addEventListener("DOMContentLoaded", () => {
    Game.init();   // legt defaults, Haufen, UI-Listener an
  });
  ```
- **Kein `defer`/`async`** nötig – die Skripte sind am Ende des `<body>`,
  das DOM ist bei Ausführung schon komplett.

### 3.5 CSS

- **Keine Preprocessor** (kein SCSS/LESS).
- **Responsiveness:** Flexbox + CSS Grid; Haufen in einer Flex-Box,
  `flex-wrap: wrap` für schmale Screens.
- **Mobile:** `@media (max-width: 600px)` für größere Touch-Targets,
  größere Buttons, kleinere Steine.
- **Blink:** `@keyframes blink { 0%,100% {opacity:1} 50% {opacity:0.15} }`
  mit `animation: blink 0.6s ease-in-out 2`.
- **Farben/Fonts:** System-Fonts (`-apple-system, BlinkMacSystemFont,
  "Segoe UI", Roboto, sans-serif`), keine Web-Fonts (A7: keine externen
  Zugriffe).

### 3.6 Barrierefreiheit (minimal)

- Alle interaktiven Elemente (Haufen, Buttons, Radio-Auswahl) sind
  `tabindex="0"`-erreichbar und per Tastatur bedienbar.
- `aria-live="polite"` auf dem „Aktiver Spieler" / „Letzter Zug"-Block,
  damit Screenreader den Zugwechsel ansagen.
- `<label for="…">` auf jedem Input.

### 3.7 Fehler- & Edge-Cases

| Fall                                    | Verhalten                                            |
| --------------------------------------- | ---------------------------------------------------- |
| Ungültige „Eigene Liste" (ohne `1`)    | `nim.js` wirft/returnt `null`; `game.js` zeigt Fehler, Dialog bleibt offen |
| Zug-Menge > Haufengröße                 | Button „Ziehen" disabled                             |
| KI in Verliererposition (N=0)           | `ai.js` greift auf Heuristik (Baxi: 1 aus größtem)  |
| Nur ein Haufen                          | Automatisch ausgewählt; Eingabe-Feld direkt aktiv    |
| Browser-Konsolenfehler                  | Ziel: **null** (A8) – `try/catch` + klare Fehlermeldungen im UI |

### 3.8 Testbarkeit (ohne Test-Framework)

- `nim.js` und `ai.js` sind **rein** (keine DOM-/UI-Abhängigkeit) und können
  in einer Browser-Konsole (DevTools → Console) direkt mit:
  ```js
  Nim.optimalMove([10, 7, 3], { allowed: [1,2,3,4] });
  AI.chooseMove([10, 7, 3], { allowed: [1,2,3,4] }, "Baxi");
  ```
  manuell geprüft werden.
- Abnahmekriterien aus `requirements.md` § 8 sind die „Tests" – sie werden
  als Checkliste beim lokalen Durchspielen abgehakt.

---

## 4. Kompatibilitäts-Matrix (Ziel-Plattformen)

| Browser                 | Mindestversion | Anmerkung                              |
| ----------------------- | :------------: | -------------------------------------- |
| Chrome / Edge (Chromium)| aktuelle 2     | Primär-Ziel                            |
| Firefox                 | aktuelle       | `file://` CORS: keine ES-Module → OK   |
| Safari (macOS/iOS)      | aktuelle       | `file://`: kein `fetch` nötig          |
| Opera / Brave (Chromium)| aktuelle       | Wie Chrome                             |

**Nicht unterstützt (bewusst):** IE11 (veraltet, keine `const`/`let`/
arrow-func). Alle Ziel-Browser sind Chromium- oder Gecko-aktuell.

---

## 5. Checkliste „A7 erfüllt" (Vor Auslieferung)

- [ ] `index.html` öffnet sich per **Doppelklick** unter Windows, macOS, Linux.
- [ ] Kein `import` / `export` / `<script type="module">` in irgendeiner Datei.
- [ ] Keine `npm install`, kein `node`, kein `pip`, kein `java`.
- [ ] Kein Netzwerk-Traffic (DevTools → Network → „No requests" nach Load).
- [ ] Keine `font-face`-Referenzen auf URLs.
- [ ] `console` ohne rote Fehler bei Normalbetrieb.
- [ ] Responsiv: 375 px (mobil), 768 px (Tablet), 1440 px (Desktop).
- [ ] Tastatur: Optionen öffnen (Zahnrad), Ziehen (Enter), Haufen-Wechsel (Tab).

---

## 6. Abweichung von der ursprünglichen Idee (optional)

Die alte `requirements.md` § 7 schlug `game.js` mit ES-Module-Aufteilung in
`nim.js` / `ai.js` / `ui.js` vor. Diese Arch-Datei **verwirft ES-Modules**
(§ 1.2) und **verwirft die `ui.js`-Datei** – das UI gehört zu `game.js`,
weil es eng mit dem Spielzustand verzahnt ist und die Trennung
(„reine Logik" vs. „UI") hier mehr Overhead als Nutzen bringt.

Die Aufteilung in `nim.js` (Regeln) / `ai.js` (Strategie) / `game.js`
(Zustand + UI) bleibt als **logische** Grenze erhalten; die **physikalische**
Grenze ist durch die Skript-Reihenfolge in `index.html` gegeben.
