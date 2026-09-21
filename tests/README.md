# Browser-E2E-Suite

`e2e-browser.html` ist ein dependency-freier Browser-Runner. Er lädt die echte
`../index.html` je Szenario in einem frischen Iframe und prüft die sichtbare UI
sowie `Game.state`. Es gibt keinen Build-Schritt, keinen Server und keine
Laufzeit-Abhängigkeit für den Browserlauf.

## Ausführung per `file://`

1. `tests/e2e-browser.html` im aktuellen Chromium/Chrome/Edge öffnen, zum
   Beispiel per Doppelklick oder mit der Adresse
   `file:///ABSOLUTER/PFAD/nimm/tests/e2e-browser.html`.
2. Im Runner müssen die sieben Szenarien mit `PASS` erscheinen (inkl.
   „Nimm!“-Bestätigung vom Issue #17 und „Neue Auswahl ersetzt / Escape
   bricht ab“). Die Gesamtausgabe steht zusätzlich in `#summary`; bei einem
   Fehler werden Szenarioname und fehlende Assertion ausgegeben.
3. Der Runner beendet vor jedem Szenario laufende KI-/Animations-/Feedback-
   Timer, stoppt das Iframe und entfernt es anschließend. Jede Runde startet
   deshalb mit einer frischen echten Spielseite.

`index.html` lädt den Worker nicht fest, sondern über `e2e-loader.js` nur im
Iframe mit `?e2e=1`. Dadurch bleibt diese Fallback-Suite lokal per `file://`
erhalten, während die öffentliche Pages-Seite den Testharnisch nicht ausliefert.

Der Pointer-Test erzeugt einen echten `PointerEvent`-Down/Up-Pfad auf der
gerenderten dritten Rosine. Die Optionen setzen `minSteine = maxSteine`, damit
alle getesteten Haufen reproduzierbar sind.

## Node-Regressionssuite

Die bestehende handgebaute Node-Suite bleibt separat:

```sh
for t in tests/*.test.js; do node "$t"; done
node --check game.js
node --check ai.js
node --check nim.js
```

Die Browser-Datei heißt absichtlich nicht `*.test.js`, damit sie nicht in diese
Node-Schleife fällt.

## Dev-Toolchain (Formatierung & Linting)

Die Toolchain besteht ausschließlich aus Dev-Dependencies (`package.json`,
`package-lock.json`) und ändert die ausgelieferte `file://`-Anwendung nicht:

```sh
npm ci                    # Toolchain aus dem Lockfile reproduzieren
npm run format:check      # Prettier-Check (HTML/CSS/Markdown/JS) über alle Dateien
npm run format            # Prettier schreibt die Formatierung
npm run lint              # ESLint (Flat Config): Produktion (game/nim/ai.js) + Tests
npm run check             # format:check + lint zusammen (wie in der CI)
npm test                  # die Node-Regressionssuite aus oben
npm run test:unit         # Unit-Tests für nim.js / ai.js (eingerbauter node:test-Runner)
npm run coverage          # Unit-Tests mit Coverage-Gate (c8) — Job rot unter Schwelle
```

### Unit-Tests & Coverage (Issue #14)

- `tests/unit/nim.test.js` / `tests/unit/ai.test.js` nutzen den eingebauten
  Node-Test-Runner (`node --test`) und prüfen Verhalten der öffentlichen
  `window.Nim`- bzw. `window.AI`-APIs (Regelparsing, Legalität, Grundy-Tabelle,
  NIM-Summe, optimale Züge, Charakterstrategien). Nicht-Determinismus wird
  durch einen gesteuerten `crypto.getRandomValues`-Rückweg in der Testlaufzeit
  reproduzierbar — der Produktionscode bleibt unverändert.
- **Coverage-Schwelle (bewusst, keine Prozent-Show):** `npm run coverage`
  erzwingt für `nim.js`/`ai.js` ≥ 95 % Statements, ≥ 95 % Branches, 100 %
  Funktionen und ≥ 95 % Lines (aktuell ~99 %). Die Schwelle liegt unter dem
  messbaren Wert, damit übliche, sinnvoll abgedeckte Änderungen nicht an
  Rauschen brechen, aber jede echte Logiklücke (neue Funktion ohne Tests,
  totes Zweig-Code) den Job rot macht — bei Unterschreitung ist der
  CI-Abschluss also FALLEN, nicht still ignoriert.

### CI (`.github/workflows/ci-pages.yml`)

Die CI führt auf jedem Push und Pull Request an `main` (Node 22, `npm ci`) in
deterministischer Reihenfolge aus:

`format:check` → `lint` → `test:unit` → `coverage` (Gate) →
Node-Regressionstests.

Erst danach wird GitHub Pages deployed; ein roter Quality-Job blockiert den
Deploy. Das Pages-Artifact enthält nur Spiel-Dateien (`index.html`,
`style.css`, `nim.js`, `ai.js`, `game.js`, `e2e-loader.js`) — nicht Tests,
Docs oder `package.json`. **Playwright-E2E (Issue #15) läuft bewusst NICHT
in der CI** — diese wird lokal bei Bedarf mit `npm run test:e2e` ausgeführt.

### Playwright-E2E (Issue #15 — lokal bei Bedarf)

Die Browser-Suite unter `tests/e2e/` lädt die echte `index.html` per `file://`
(kein Webserver, kein Build) und deckt dieselben Szenarien ab wie die
dependency-freie Fallback-Suite (`tests/e2e-browser.html`, bleibt erhalten
für Doppelklick/Offline-Abnahme):

```sh
npm run e2e:install-browsers   # einmalig: Chromium für Playwright installieren
npm run test:e2e               # Suite starten (Chromium, workers=1, deterministisch)
```

- Keine festen Wartezeiten: Zustände werden per `expect.poll`/`waitForFunction`
  abgefragt (Lock, Denkblase, Haufen-Feedback, Overlay).
- Fehler erzeugen **lokale** Artefakte (Trace, Screenshot, Video
  „retain-on-failure“ in `test-results/` + HTML-Bericht in
  `playwright-report/`) — es gibt keine Artefakt-Uploads nach GitHub, weil
  die Suite nicht in der CI läuft.
- `pageerror` und relevante Konsolenausgaben werden hart gefasst.
- Die Fallback-Suite `tests/e2e-browser.html` läuft daneben weiter (7/7) und
  erfordert keine Installation.
