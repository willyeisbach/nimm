# Browser-E2E-Suite

`e2e-browser.html` ist ein dependency-freier Browser-Runner. Er lädt die echte
`../index.html` je Szenario in einem frischen Iframe und prüft die sichtbare UI
sowie `Game.state`. Es gibt keinen Build-Schritt, keinen Server und keine
Laufzeit-Abhängigkeit für den Browserlauf.

## Ausführung per `file://`

1. `tests/e2e-browser.html` im aktuellen Chromium/Chrome/Edge öffnen, zum
   Beispiel per Doppelklick oder mit der Adresse
   `file:///ABSOLUTER/PFAD/nimm/tests/e2e-browser.html`.
2. Im Runner müssen sechs Szenarien mit `PASS` erscheinen. Die Gesamtausgabe
   steht zusätzlich in `#summary`; bei einem Fehler werden Szenarioname und
   fehlende Assertion ausgegeben.
3. Der Runner beendet vor jedem Szenario laufende KI-/Animations-/Feedback-
   Timer, stoppt das Iframe und entfernt es anschließend. Jede Runde startet
   deshalb mit einer frischen echten Spielseite.

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
