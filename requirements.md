# NIM – Anforderungen (Requirements)

Browserbasiertes NIM-Spiel für **zwei Spieler**, die abwechselnd ziehen. Diese
Datei ist der **Problemraum**: Sie beschreibt *was* das Spiel leisten soll, nicht
*wie* es umgesetzt wird. Laufzeit ist der **Browser**; es gibt kein Backend und
keinen Build-Schritt. Die Randbedingungen für lokale Ausführung und
Plattformunabhängigkeit sind in **Abschnitt 7** festgelegt; die konkrete technische
Umsetzung wird in **`architecture.md`** beschlossen.

---

## 1. Ziel

- **Spiel:** NIM (mehrere Haufen Steine, Spieler nehmen pro Zug aus genau einem
  Haufen, letzter Stein gewinnt).
- **Kein Backend**, keine Persistenz. Der Spielzustand ist im Speicher; ein
  Neuladen startet mit den gespeicherten Defaults neu.
- Alles soll **auf einer Seite** laufen, mobile- und desktoptauglich.
- Wie das technisch umgesetzt wird, ist **nicht** Teil dieser Datei, sondern in
  `architecture.md` festgelegt.

---

## 2. Grundregeln des Spiels (Basis)

- Zwei Spieler ziehen **abwechselnd**.
- Pro Zug dürfen Steine **ausschließlich aus genau einem Haufen** genommen werden.
- Welche **Anzahl** Steine genommen werden darf, legt die gewählte **Zugregel** fest
  (s. Abschnitt 3.2).
- **Gewinnbedingung (normal):** **Wer den letzten Stein nimmt, gewinnt.**
- Das Spiel endet, wenn in keinem Haufen mehr Steine sind.

---

## 3. Konfiguration / Startparameter

Die Parameter werden im **Options-Dialog** (Zahnrad, oben rechts) gesetzt. Sie gelten
erst, nachdem **„Änderung übernehmen"** betätigt wurde – dies startet **automatisch
ein neues Spiel** mit den neuen Werten.

### 3.1 Parameterübersicht

| Parameter                  | Eingabe   | Default     | Erläuterung                                            |
| -------------------------- | --------- | ----------- | ------------------------------------------------------ |
| Maximale Haufenzahl        | Zahl ≥ 1  | `1`         | Obergrenze für die Anzahl der Haufen                   |
| Zugregel                   | Auswahl   | `4er-Nimm`  | klassisch / 4er-Nimm / eigene Liste (s. 3.2)           |
| Maximale Steine pro Haufen | Zahl ≥ 1  | `20`        | Obergrenze der Größe eines einzelnen Haufens           |
| Minimale Steine pro Haufen | Zahl ≥ 0  | `10`        | Untergrenze der Größe eines einzelnen Haufens          |
| Gegner (Spieler 2)         | Radio     | `Mensch`    | `Mensch` / `Baxi` / `Ducola` / `Muisa`                 |
| Name Spieler 1             | Text      | `Spieler 1` | Anzeigename (menschlicher Spieler 1)                   |
| Name Spieler 2             | Text      | `Spieler 2` | Anzeigename (wird bei KI-Wahl mit KI-Namen vorbelegt)  |

**Allgemeine Validierung der Parameter:**
- `minSteine ≤ maxSteine`.
- `minSteine ≥ 0`, `maxHaufen ≥ 1`.
- Bei Wahl einer KI wird das Name-Feld von Spieler 2 mit dem KI-Namen
  (`Baxi` / `Ducola` / `Muisa`) **vorbelegt** (überschreibbar).
- Bei ungültigen Werten: Fehler anzeigen, **„Übernehmen" bleibt gesperrt.**

### 3.2 Zugregeln im Detail

Drei Modi (Radio-Auswahl im Options-Dialog):

1. **Klassisch** – Aus einem Haufen dürfen **beliebig viele** Steine genommen
   werden (jede Menge `1` bis zur aktuellen Haufengröße).
2. **4er-Nimm** – Erlaubte Nehm-Mengen: `{1, 2, 3, 4}`.
3. **Eigene Liste** – Freitext: **kommaseparierte** positive Ganzzahlen,
   z. B. `1,3,5` oder `2,4,7`.

**Validierung „Eigene Liste":**
- Alle Einträge müssen **positive Ganzzahlen** (`≥ 1`) sein.
- **`1` muss enthalten sein** (sonst ist der Zug auf leere Haufen/Ende blockiert).
- Duplikate werden entfernt, die Liste wird **aufsteigend sortiert**.
- Bei ungültiger Eingabe: Fehlermeldung im Feld, Änderung **wird nicht übernommen**.

**Folge für die Grundy-Werte** (für die KI, s. Abschnitt 4.1):
- Klassisch: `g(n) = n`.
- 4er-Nimm (`{1,2,3,4}`): `g(n) = n mod 5`.
- Eigene Liste: `g(n)` via mex-Rekursion (s. 4.1).

### 3.3 Haufen-Generierung beim (Neu-)Start

- **Anzahl der Haufen** = Zufallszahl in `[1, maxHaufen]`.
- **Größe jedes Haufens** = unabhängige Zufallszahl in `[minSteine, maxSteine]`.
- *(Annahme – siehe Abschnitt 9, offene Frage Q1.)*

---

## 4. Gegner / KI-Charaktere

Alle drei KI-Spieler treffen ihre Züge auf Basis des **gleichen Grundy-Modells**
(Sprague–Grundy). Der Unterschied liegt in der **Strategie**, je nach Situation.
„Gesamtsteinanzahl" = Summe aller Steine über alle Haufen **in der aktuellen
Stellung** (vor dem eigenen Zug).

### 4.1 Gemeinsames Modell (Grundy / NIM-Summe)

- Erlaubte Nehm-Mengen `A` (sortiert, enthält stets `1`).
- Grundy-Wert eines Haufens der Größe `n`:
  - `g(0) = 0`
  - `g(n) = mex{ g(n − a) : a ∈ A und a ≤ n }`  (mex = kleinste nicht vorhandene Zahl)
  - → Tabelle `g[0 … maxSteine]` wird vorab einmal berechnet.
- **NIM-Summe** der Stellung `P = (n_1 … n_p)`: `N = g(n_1) XOR g(n_2) XOR … XOR g(n_p)`.
- Die Stellung ist **gewinnbar** für den am Zug stehenden Spieler **genau dann, wenn `N ≠ 0`**.

**Optimaler Zug (wenn `N ≠ 0`):**
- Für jeden Haufen `i` berechne `target_i = N XOR g(n_i)`.
- Wähle einen Haufen `i` und eine Menge `a ∈ A` mit `a ≤ n_i` und
  `g(n_i − a) = target_i`. (Nach dem NIM-Strategie-Theorem existiert mindestens ein
  solcher Zug.) Damit wird die NIM-Summe auf `0` gesetzt → „Bitparität" wird
  hergestellt.

**Verliererposition (`N = 0`):** Kein Gewinnzug existiert; die KI greift auf eine
Heuristik zurück (bei Baxi: s. 4.2).

### 4.2 Baxi – spielt **immer** optimal

- Wenn `N ≠ 0`: optimaler Zug nach 4.1 (NIM-Summe auf 0 zwingen).
- Wenn `N = 0` (Verliererposition): **nimm die kleinstmögliche Menge**
  (= `min(A)`, also `1`, da `1 ∈ A`) **aus dem größten Haufen**.

### 4.3 Ducola – großzügig früh, optimal spät

- **Wenn Gesamtsteinanzahl > 10:** Zieht so, dass sie **falls möglich dem Gegner die
  Gewinnmöglichkeit lässt** – d. h. sie wählt einen legalen Zug, nach dem die
  NIM-Summe `N' ≠ 0` ist (Gegner am Zug in Gewinnposition).
  - „Falls möglich" = es existiert ein legaler Zug mit `N' ≠ 0`.
  - **Falls kein solcher Zug existiert** (alle legalen Züge ergeben `N' = 0`):
    **zufälliger legaler Zug** (Haufen zufällig, Menge zufällig aus
    `A ∩ {1 … n_i}`).
  - Bei mehreren zulässigen Zügen: **zufällige Wahl** unter den passenden Zügen.
- **Sonst (Gesamtsteinanzahl ≤ 10):** optimal (wie Baxi).

### 4.4 Muisa – zufällig früh, optimal spät

- **Wenn Gesamtsteinanzahl > 5:** **zufälliger** legaler Zug
  (Haufen zufällig, Menge zufällig aus `A ∩ {1 … n_i}`).
- **Sonst (Gesamtsteinanzahl ≤ 5):** optimal (wie Baxi).

### 4.5 Allgemeines KI-Verhalten (UX)

- Zieht die KI (Spieler 2), geschieht dies **automatisch**, nachdem kurz angezeigt
  wurde, dass die KI am Zug ist (kleine Verzögerung ~600–900 ms für „Denk"-Effekt).
- Auch KI-Züge lösen die **Blink-Animation** aus (s. 5.5).
- Eingaben sind während eines KI-Zugs gesperrt.

---

## 5. Benutzeroberfläche (UI)

### 5.1 Hauptbildschirm / Layout

- **Anzeige der Haufen** mit den enthaltenen Steinen (Steine als sichtbare Kreise/
  Punkte). Mehrere Haufen nebeneinander, beschriftet (z. B. „Haufen 1" + Anzahl).
- **Aktiver Spieler:** deutlich sichtbar, wer am Zug ist (Name + ggf. Rolle
  Mensch/KI).
- **Letzter Zug:** Anzeige, was der zuletzt ziehende Spieler genommen hat
  (Name, Haufen, Anzahl). Z. B. `Baxi hat 3 aus Haufen 2 genommen`.
  (Vor dem ersten Zug: kein Eintrag / „–".)
- **Aktuelle Zugregel auf dem Spielfeld (Issue #2):** Eine dauerhafte, gut
  lesbare Zeile zeigt die *aktuelle* Regel in Kindersprache und passt sich
  automatisch an, wenn per Optionen eine andere Regel übernommen wird:
  - Klassisch: „Nimm so viele Rosinen, wie du willst — aber nur aus *einem* Haufen."
  - 4er-Nimm: „Nimm 1, 2, 3 oder 4 Rosinen — aber nur aus *einem* Haufen."
  - Eigene Liste: dieselben Zahlen der Liste (z. B. „Nimm 1, 3 oder 5 Rosinen …").
  - Gewinnregel bleibt sichtbar: „Wer die letzte nimmt, gewinnt."
  - Funktioniert ohne Start-Overlay; im Overlay ist sie zusätzlich erlaubt.
- **Anzeigennamen vor der ersten Runde (Issue #6):** Die Options-Felder
  „Dein Name" und „Name vom Gegner" stehen **vor** den übrigen Parametern
  (Haufen/Regel). Kommt ein Name noch als Platzhalter („Spieler 1" bzw.
  „Spieler 2") vor der ersten Runde ins Spiel, fragt das Start-Overlay
  (s. Issue #1) kurz nach den Anzeigenamen — als ersten Schritt desselben
  Panels, nicht als zweites Modal. „Los!" bestätigt die Namen und lässt
  dann den ersten Zug zu. Bei Auswahl einer KI wird der Name von Spieler 2
  mit dem Charakternamen (`Baxi`/`Ducola`/`Muisa`) vorbelegt und zählt als
  gesetzt. **Keine Persistenz:** nach einem Neuladen kehren die Namen zu
  den Defaults zurück (kein localStorage, keine Cookies).
- **Zugauslösung am Haufen (Issue #3):** Ein **Tipp auf eine Rosine** oder
  **Ziehen-Loslassen** führt unmittelbar den Zug aus (Menge = die markierten
  Steine, gesnappt/geklemmt auf die erlaubte Menge). Es gibt **keine
  Mengen-Leiste** (kein Ziffernfeld, +/– oder „Nimm!"-Button) mehr; Auswahl
  bleibt per Klick/Tastatur möglich.
- **Options-Zahnrad** in der **oberen rechten Ecke** öffnet/schließt den
  Options-Dialog (s. 5.2).

### 5.2 Options-Dialog (Zahnrad)

- Enthält alle Parameter aus 3.1 (inkl. Zugregel-Auswahl, bei „Eigene Liste" ein
  Freitextfeld).
- Button **„Änderung übernehmen"** → validiert, speichert und **startet ein neues
  Spiel**.
- Button **„Abbrechen"/Schließen** → Dialog schließt, Spiel läuft unverändert weiter.

### 5.3 Zugauslösung und Regelprüfung (Issue #3)

Ein Tipp oder Ziehen-Loslassen setzt `pendingAmount` (die vom Tipppunkt
abgeleitete, gesnappte Menge) und rührt `executeMove` aus.
Die Menge ist **gültig** (Zug läuft), wenn **alle** Bedingungen gelten:
- Menge ist eine **positive Ganzzahl** (`≥ 1`).
- Menge ist in der **erlaubten Menge** der aktuellen Zugregel enthalten
  (Klassisch: `≤ Haufengröße`; 4er-Nimm/Eigene Liste: Wert ∈ `A`).
- Menge `≤` der Größe des **treffenden Ziel-Haufens**.

Gesnappte/geklemmte Werte sind legal und führen den Zug aus.
Ungültige oder gesperrte Werte führen **keinen** Zug aus und melden sich
**am betroffenen Haufen**: das Haufen-Element schüttelt kurz und zeigt eine
Blase in Kindersprache an (Issue #8):
- Menge > Haufengröße → „So viele sind nicht da!"
- Menge nicht in der erlaubten Menge → erlaubte Zahlen nennen, z. B.
  „Nur 1, 3 oder 5 Steine!" bzw. „Nur 1, 2, 3, 4 Steine!"
Die Blase verschwindet nach ~1,6 s; kein Formular-Fehlerfeld, keine
Alert-Dialoge, kein klemmender Lock — der nächste legale Zug ist danach
sofort möglich.

### 5.4 Anzeige letzter Zug
- Siehe 5.1 (Nachvollziehbarkeit, wer was wann genommen hat).

### 5.5 Animation (Stein-Entfernung)

- **Rundenstart wartet auf „Los!" (Issue #1):** Nach Start, „Noch mal!" und
  „Änderung übernehmen" hält die Runde an: Die Haufen sind sichtbar,
  ein Panel auf dem Spielfeld nennt, wer beginnt („… beginnt!"), und erst
  der Klick auf **Los!** lässt den ersten Zug zu. Beginnt die KI, denkt
  sie danach wie bisher (600–900 ms). Beginnt ein Mensch, ist die Eingabe
  frei. Während des Wartens gibt es **keinen** Zug-Lock — Optionen und
  „Neue Runde" bleiben bedienbar; kein Countdown, kein automatischer Start.
  Gilt auch bei Mensch-gegen-Mensch (kein weggeklauter erster Zug).

- Wenn ein Spieler zieht, **blinken die zu entfernenden Steine** kurz (z. B.
  3–4 Blips / ~600–800 ms, CSS-Klasse `blinking` mit Opacität/Visibilität).
- Danach werden die Steine aus dem Haufen entfernt, die Anzeige aktualisiert sich.
- Während der Animation sind Eingabe und Button **gesperrt** (kein Doppelzug).
- **KI-UX (Issue #7):** Zieht die KI, zählt sie die genommenen Rosinen laut in
  ihrer Sprechblase mit — schrittweise passend zur Menge (z. B. „Eins…" →
  „Zwei…" → „Drei — Nimm!"), aufgeteilt über die Dauer der Blink-Animation.
  Menschliche Züge brauchen kein Mitzählen.

### 5.6 Sieg & noch mal!

- Wird der **letzte Stein** genommen:
  - **Gratulation** an den Sieger (Name prominent anzeigen, z. B.
    `🎉 Gewonnen hat <Name>!`).
  - **Primärer Button „Noch mal!"** (identisch beschriftet wie die Toolbar)
    → startet eine neue Runde mit den **aktuell gültigen** Parameter-Einstellungen
    (neue zufällige Haufen, **zufälliger** Spieler beginnt).
  - Optional: kleiner „Fertig"-Button, der NUR das Overlay ausblendet
    (Brett bleibt stehen) — kein dritter Button, keine Optionen im Overlay
    (Zahnrad oben bleibt).
- Optional: kurze Hervorhebung des Siegers.

---

## 6. Validierung (Zusammenfassung)

| Stelle            | Regel                                                                      |
| ----------------- | -------------------------------------------------------------------------- |
| Options-Parameter | `min ≤ max`, `maxHaufen ≥ 1`, Zugregel-Liste gültig, `1` in Liste          |
| Zugregel-Liste    | positive Ganzzahlen, `1` enthalten, Duplikate raus, sortiert               |
| Zug (am Haufen) | `≥ 1`, in erlaubter Menge, `≤` Ziel-Haufen-Größe                        |
| Tipp/Drag       | legal ⇒ Zug; sonst kein Zug (Snap/Klemmen)                                |

---

## 7. Lokale Ausführung & Plattformunabhängigkeit (Randbedingung)

Diese Anforderung gilt als **hart** und überschreibt jede einzelne
Umsetzungsentscheidung, die ihr widerspricht:

- **Läuft lokal auf jedem Computer**, ohne dass dafür irgendetwas installiert,
  kompiliert oder gestartet werden muss.
- **Keine Laufzeit-Voraussetzungen:** kein Node.js, keine Python-, Java- oder
  andere Laufzeit, kein Interpreter, kein Paketmanager, kein Server.
- **Plattformunabhängig:** identisches Verhalten unter **Windows, macOS und
  Linux** in gängigen, aktuellen Browsern.
- **Keine externen Abhängigkeiten:** kein Framework, kein CDN, keine
  Netzwerkzugriffe, keine Fonts/Bibliotheken, die zur Laufzeit geladen werden
  müssen.
- **Kein Build-/Installations-Schritt:** Die ausgelieferten Dateien werden
  unverändert ausgeliefert und direkt im Browser geöffnet (per
  Datei-Link bzw. Doppelklick). Ein Webserver ist ausdrücklich *nicht*
  erforderlich.

Die konkrete technische Umsetzung dieser Randbedingung (gewähltes
Technologie-Spektrum, Datei-Organisation, Kompatibilitätsregeln) ist in
**`architecture.md`** beschrieben.

---

## 8. Abnahmekriterien (Acceptance)

- [ ] Spiel startet mit Defaults: **1 Haufen**, Größe zufällig **10–20**, **4er-Nimm**,
      Spieler 2 = **Mensch**, **zufälliger** Spieler beginnt.
- [ ] Zahnrad (oben rechts) öffnet/schließt Options; **„Übernehmen" startet neues
      Spiel** mit den neuen Werten; „Abbrechen" ändert nichts.
- [ ] Alle drei Zugregeln funktionieren; ungültige „Eigene Liste" (ohne `1` /
      nicht numerisch) wird abgelehnt.
- [ ] Nur Steine **aus einem Haufen** pro Zug; ein Tipp/Ziehen führt den Zug
      genau dann aus, wenn die abgeleitete Menge für den betroffenen Haufen legal ist.
- [ ] Aktiver Spieler und letzter Zug werden angezeigt.
- [ ] Zu entfernende Steine **blinken**, dann verschwinden sie.
- [ ] **Letzter Stein** → Gratulation + „Noch mal!"-Button (neue Runde,
      Parameter beibehalten).
- [ ] **Baxi** zwingt bei Gewinnposition die NIM-Summe auf 0; in Verliererposition
      nimmt `1` aus dem größten Haufen.
- [ ] **Ducola** lässt (bei >10 Steinen) dem Gegner eine Gewinnposition,
      sonst optimal.
- [ ] **Muisa** spielt (bei >5 Steinen) zufällig, sonst optimal.
- [ ] Läuft ohne Konsolenfehler, ohne externe Abhängigkeiten, im lokalen Browser.

---

## 9. Annahmen & offene Fragen

**Bestätigte Entscheidungen:**
- **Haufenzahl:** zufällig in `[1, maxHaufen]`.
- **KI-Schwellen** (Ducola >10, Muisa >5) beziehen sich auf die **Gesamtsteinanzahl**
  (Summe aller Haufen) in der aktuellen Stellung.
- **Ducola-Fallback:** Wenn bei >10 Steinen kein legaler Zug den Gegner in
  Gewinnposition bringt → **zufälliger legaler Zug**.
- **Name 3. KI:** **Muisa**.
- **Beginn:** **zufälliger Spieler** (S1 oder S2) beginnt.
- **Spieler 1** ist immer der **menschliche** lokale Spieler.
- **Spieler 2** = der gewählte **Gegner** (Mensch oder KI).

---

## 10. Erweiterungs-Runde 1: Nutzererfahrung für Kinder (Ausbaustufe)

**Zielgruppe:** 7–9-jährige Kinder, die NIM als Rechenübung spielen und
weder Mod-4-Invarianz, Grundy-Werte noch Bitparität kennen. Alles muss sich
wie ein Spiel anfühlen, nicht wie ein Formular.

- **Zugabgabe direkt am Haufen (Issue #3):** Züge laufen ausschließlich am
  Haufen — ein **Tipp auf die n-te Rosine von oben = ein Zug mit n
  Rosinen** (gesnappt/geklemmt auf die erlaubte Menge der aktuellen
  Regel), und **Ziehen-Loslassen** führt denselben Zug aus. Die frühere
  Mengen-Leiste (Ziffernfeld, +/–, „Nimm!"-Button) ist als Formular-Fallback
  entfernt.
- **Charaktere mit Gesichtern & Sprechblasen:** Beide Spieler erscheinen als
  Karten mit Emoji-Gesicht, Name, Rolle und Sprechblase. Die KI reagiert:
  - „denkt…" (geduldig, ~0,6–0,9 s),
  - **lacht höhnisch**, wenn der Mensch in eine Verliererposition gezogen
    hat (NIM-Summe ≠ 0),
  - **ist wütend/genervt**, wenn sie selbst in einer Verliererposition steht
    und NICHT mehr gewinnen kann,
  - **feiert/ist sauer** beim Spielende je nach Ausgang.
  Gesichter werden DOM-seitig gesetzt (kein Grundy-Jargon, Kindersprache).
- **Rückgängig-Button:** Aktivierbar im Options-Dialog (Checkbox, Default
  aus). Setzt den letzten Menschenzug (im KI-Modus plus die KI-Antwort)
  zurück.
  Funktioniert auch, während die KI gerade „denkt".
- **Startspieler wählbar:** Zufällig (Default) / Spieler 1 / Spieler 2.
- **Noch mal!:** Immer sichtbarer Toolbar-Button, ohne Overlay und ohne
  Parameter-Änderung (Options-Overwrite bleibt unverändert); der primäre
  Sieg-Overlay-Button heißt identisch „Noch mal!" (neue Runde, alte Parameter).
- **Sieg-Overlay** mit Gesicht, Botschaft, einem primären „Noch mal!" und
  optionalem kleinem „Fertig" (blendet nur das Overlay aus, Brett bleibt stehen);
  kein dritter Button, keine „Optionen öffnen" im Overlay (Zahnrad oben bleibt).
- **Konfetti** beim Sieg (DOM-only, keine Assets, keine Bibliothek).
- **Rosinen-Optik:** Haufen sehen aus wie Rosinen (Braunton, unregelmäßig),
  großer Touch-Radius, farbenfrohe Kindertypografie.
- **Regelkonformität:** Alle Validierungs- und Zuglogik-Regeln aus §2–§6
  bleiben byte-identisch; alle fünf bestehenden Regressionstests müssen grün
  bleiben (und wurden es).

---
