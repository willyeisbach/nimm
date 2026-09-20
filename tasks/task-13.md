# Task 13 – `game.js`: Options-Dialog (Zahnrad)

> **Wichtig für dich (KI):** Lies vor Beginn **`architecture.md`** §2.1, §3.3, §3.6,
> §3.7 und **`requirements.md`** §3.1, §3.2, §5.2 und §6. Diese Datei ist
> **selbsterklärend**: Du brauchst nur sie, die zwei Docs und den unten
> beschriebenen **Codestand** — **keine andere Task-Datei** lesen.

## Lies zuerst

- `requirements.md` → §3.1 (Parameter, Defaults, Validierung), §3.2 (Zugregeln + „Eigene Liste"), §5.2 (Options-Dialog), §6.
- `architecture.md` → §3.3 (Options-Dialog, Validierung, Übernehmen → neues Spiel), §3.6 (Labels, `aria-invalid`), §3.7 (ungültige „Eigene Liste").

## Ausgangszustand (Code, den du vorfindest)

- `index.html` enthält das Zahnrad (oben rechts) — aktuell noch ohne Funktion;
  der Options-Dialog/Overlay-Struktur fehlt noch bzw. ist leer.
- `game.js` enthält bereits (aus Task 08–12): `Game.state`, `Game.start()`,
  `Game.render()`, `Game.executeMove()`, `Game.newGame()`.
- `nim.js` liefert `Nim.parseAllowed(rule, ownList)` (→ `null` bei ungültiger Liste).
- Du **erweiterst** `index.html` (Dialog-Markup) und **`game.js`** (Logik).

## Ziel

### `index.html` (Markup ergänzen)

- Options-Dialog: `<dialog>` **oder** `<div class="options" hidden>` mit:
  - **Maximale Haufenzahl** (Zahl ≥ 1, Default `1`).
  - **Zugregel** (Radio: `Klassisch` / `4er-Nimm` / `Eigene Liste`).
  - **Eigene Liste** (Freitext, **nur sichtbar/aktiv** bei „Eigene Liste").
  - **Maximale Steine pro Haufen** (Zahl ≥ 1, Default `20`).
  - **Minimale Steine pro Haufen** (Zahl ≥ 0, Default `10`).
  - **Gegner (Spieler 2)** (Radio: `Mensch` / `Baxi` / `Ducola` / `Muisa`, Default `Mensch`).
  - **Name Spieler 1** (Text, Default `Spieler 1`).
  - **Name Spieler 2** (Text, Default `Spieler 2`).
  - Button **„Änderung übernehmen"**, Button **„Abbrechen"**.
  - Fehler-Meldung `<p>` im Dialog.
  - Jedes Input-Feld mit `<label for="…">`; alle `tabindex`-erreichbar.

### `game.js`

1. **Öffnen/Schließen**: Zahnrad-Klick toggelt den Dialog (hidden). „Abbrechen"
   schließt den Dialog, **Spiel läuft unverändert weiter** (keine Änderung).
2. **`Game.validateOptions()`** → `boolean` (+ setzt Fehlermeldungen):
   - `maxHaufen ≥ 1`.
   - `minSteine ≥ 0`, **`minSteine ≤ maxSteine`**.
   - Bei **Eigene Liste**: `Nim.parseAllowed("own", ownList)` ist **nicht** `null`
     (also: positive Ganzzahlen, `1` enthalten, nicht leer).
   - Bei Fehler: Fehler-`<p>` befüllen, `aria-invalid` setzen, **„Übernehmen" disabled**.
3. **KI-Namen-Vorbelegung**: Bei Auswahl einer KI (Baxi/Ducola/Muisa) wird das
   Name-2-Feld **mit dem KI-Namen vorbelegt** (überschreibbar).
4. **`Game.applyOptions()`** (Button „Änderung übernehmen" Handler):
   - Nur ausführen, wenn `validateOptions()` `true` ist.
   - Schreibt die Werte in `Game.state` (Konfiguration + Namen + Gegner).
   - Leitet `Game.state.allowed` neu ab (via `Nim.parseAllowed`).
   - Schließt den Dialog und ruft **`Game.start()`** auf (startet **neues Spiel**
     mit den neuen Werten).
5. **Zufälliger Beginns-Spieler**: bereits in `Game.start()` (Task 08) — hier nur
   sicherstellen, dass `start()` bei Übernahme aufgerufen wird.

## Relevante Vorgaben (Zusammenfassung)

- Parameter-Defaults: 1 / `4er` / 20 / 10 / `Mensch` / `Spieler 1` / `Spieler 2`.
  → `req §3.1`.
- Validierung: `min ≤ max`, `maxHaufen ≥ 1`, Zugregel-Liste gültig + `1` in Liste;
  bei KI → Name 2 vorbelegen; ungültig → Fehler, **„Übernehmen" bleibt gesperrt**.
  → `req §3.1`, `req §6`.
- „Änderung übernehmen" → validiert, speichert, **startet neues Spiel**;
  „Abbrechen" → schließt, Spiel unverändert. → `req §5.2`, `arch §3.3`.
- `<dialog>` oder `<div class="options" hidden>`; **kein** Framework-Modal.
  → `arch §3.3`.
- `<label for>` auf jedem Input; `aria-invalid` bei Fehler. → `arch §3.3/§3.6`.

## Umsetzungshinweise

- „Eigene Liste"-Freitextfeld **ausblenden/deaktivieren**, solange eine andere
  Zugregel gewählt ist (sauberes UX-Verhalten).
- `validateOptions()` liest die **aktuellen** Feldwerte (nicht `Game.state`) —
  erst `applyOptions` schreibt sie zurück.
- Fehlermeldung klein + konkret (z. B. „Eigene Liste muss die Zahl 1 enthalten").
- Das Dialog-Markup bleibt statisch; `game.js` macht nur `hidden`-Toggles und
  Event-Listener.

## Abnahmekriterien (überprüfbar – Sichtprüfung)

- [ ] Zahnrad öffnet/schließt den Dialog; alle Felder + Defaults sind korrekt
      vorbefüllt.
- [ ] „Abbrechen" schließt den Dialog; **Haufen/Spiel ändern sich nicht**.
- [ ] „Eigene Liste" = `2,4,7` (kein `1`) → **Fehlermeldung**, „Übernehmen" **inaktiv**.
- [ ] „Eigene Liste" = `1,2` → „Übernehmen" **aktiv**.
- [ ] `minSteine=15, maxSteine=10` → **Fehler**, „Übernehmen" **inaktiv**.
- [ ] `maxHaufen=0` → **Fehler**, „Übernehmen" **inaktiv**.
- [ ] Gegner = „Muisa" → Name-2-Feld wird auf **„Muisa"** vorbelegt (manuell überschreibbar).
- [ ] Gültige Änderung (z. B. `maxHaufen=3`) → Dialog schließt, **neues Spiel**
      mit neuen Haufen (Anzahl jetzt in `[1,3]`).
- [ ] Alle Inputs per **Tastatur** erreichbar (Tab), Labels vorhanden.
- [ ] Keine Konsolenfehler.

## Definition of Done

Der Options-Dialog öffnet/schließt, validiert alle Parameter (inkl. „Eigene Liste"

- KI-Namen-Vorbelegung), sperrt „Übernehmen" bei ungültigen Werten und startet bei
  Übernahme ein neues Spiel mit den neuen Werten.
