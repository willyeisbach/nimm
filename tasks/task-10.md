# Task 10 – `game.js`: Ziel-Haufen-Auswahl & Zug-Eingabe/Validierung

> **Wichtig für dich (KI):** Lies vor Beginn **`architecture.md`** §2.1, §3.2, §3.6
> und **`requirements.md`** §5.1, §5.3 und §6. Diese Datei ist **selbsterklärend**:
> Du brauchst nur sie, die zwei Docs und den unten beschriebenen **Codestand** —
> **keine anderen Task-Dateien** lesen.

## Lies zuerst
- `requirements.md` → §5.1 (Haufen-Auswahl, Eingabe, Button), §5.3 (Zugabgabe & Validierung), §6.
- `architecture.md` → §3.2 (DOM), §3.6 (Barrierefreiheit: `tabindex`, Labels).

## Ausgangszustand (Code, den du vorfindest)
- `index.html` enthält Input (`id` für „Steine zu nehmen") und Button „Ziehen".
- `game.js` enthält bereits (aus Task 08 + 09): `Game.state`, `Game.start()`,
  `Game.render()` (Haufen mit `data-heap-index`), Status-Rendering.
- `nim.js` liefert `Nim.legalAmount(rule, A, amount, heapSize)` und
  `Nim.isLegal(position, A, heapIdx, amount)`.
- Du **erweiterst** `game.js` um Auswahl + Validierung + Button-Enable-Logik.

## Ziel
In `game.js` implementieren:

1. **Ziel-Haufen-Auswahl**:
   - `Game.state.selectedHeap` (0-basiert) speichert den ausgewählten Haufen.
   - Klick auf einen `.heap` setzt `selectedHeap` und markiert ihn
     (z. B. `classList.add("selected")`, andere entfernen).
   - Jeder `.heap` ist **`tabindex="0"`** und per **Enter/Leertaste**
     auswählbar (Tastaturbedienung, s. `arch §3.6`).
   - **Bei nur einem Haufen**: automatisch ausgewählt (keine manuelle Wahl nötig).
2. **Zug-Validierung & Button-Enable**:
   - Funktion `Game.validateInput()` → `boolean`:
     - Eingabe ist **positive Ganzzahl ≥ 1**.
     - Menge ist in der **erlaubten Menge** (`Nim.legalAmount` mit
       `Game.state.rule` / `Game.state.allowed` / Ziel-Haufen-Größe).
     - Menge `≤` Größe des **ausgewählten** Haufens.
   - Button „Ziehen" ist **genau dann** enabled, wenn `validateInput()` `true`
     ist; sonst **disabled/grau**.
   - Validierung **reaktiv**: bei jeder Änderung des Inputs **und** bei jeder
     Änderung des Ziel-Haufens (Klick/Taste) neu ausführen.
   - Ungültige Eingabe → kleine Fehler-/Hinweismeldung im UI.

## Relevante Vorgaben (Zusammenfassung)
- Haufen-Auswahl per Klick, markiert/highlighted; **1 Haufen → automatisch
  Ziel**. → `req §5.1`.
- Eingabefeld gültig: positive Ganzzahl ≥ 1, in erlaubter Menge,
  ≤ Ziel-Haufen-Größe; **Button nur bei gültiger Eingabe aktiv**.
  → `req §5.3`, `req §6`.
- Alle interaktiven Elemente `tabindex="0"`-erreichbar + tastaturbedienbar;
  `<label for>` auf jedem Input. → `arch §3.6`.

## Umsetzungshinweise
- Zentrale `updateButtonState()`-Funktion, die Input-Wert, `selectedHeap` und
  Regel zusammenführt und den Button-Status + Fehlermeldung setzt.
- Bei **Klassisch** ist „in erlaubter Menge" trivial (nur `≤ Haufengröße`);
  `Nim.legalAmount` übernimmt das — `game.js` muss die Regel **nicht** selbst kennen.
- Fehlermeldung klein halten (z. B. ein `<p>` mit `id`), nicht aufdringlich.
- Halte `Game.state.selectedHeap` konsistent mit dem DOM-Highlight.

## Abnahmekriterien (überprüfbar – Sichtprüfung/Konsole)
- [ ] **4er-Nimm**, Haufen=10: Eingabe `4` → Button **aktiv**; `5` → **inaktiv**;
      `0`/leer → inaktiv.
- [ ] **Klassisch**, Haufen=10: `10` → aktiv; `11` → inaktiv; `1` → aktiv.
- [ ] **Eigene Liste** `1,3,5`, Haufen=6: `3` → aktiv; `2` → inaktiv; `6` → inaktiv.
- [ ] **2 Haufen**: Klick wechselt Auswahl + Highlight; Button-Status passt sich
      an die **neue** Haufengröße an.
- [ ] **1 Haufen**: automatisch ausgewählt (Klasse/Highlight), Eingabe sofort nutzbar.
- [ ] **Tastatur**: `Tab` bis zum Haufen, `Enter` wählt aus; `Tab` zum Input,
      Wert eingeben, Button-Status aktualisiert sich.
- [ ] Ungültige Eingabe zeigt eine **Fehlermeldung**; Button bleibt disabled.
- [ ] Keine Konsolenfehler.

## Definition of Done
Ziel-Haufen-Auswahl (Klick + Tastatur), Input-Validierung und Button-Enable
sind reaktiv und korrekt für alle drei Zugregeln; Barrierefreiheit erfüllt.
