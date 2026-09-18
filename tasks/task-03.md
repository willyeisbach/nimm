# Task 03 – `nim.js`: Grundy-Tabelle via mex

> **Wichtig für dich (KI):** Lies vor Beginn **`architecture.md`** §2.1 und
> **`requirements.md`** §3.2 („Folge für die Grundy-Werte") und §4.1. Diese Datei ist
> **selbsterklärend**: Du brauchst nur sie, die zwei Docs und den unten
> beschriebenen **Codestand** — **keine anderen Task-Dateien** lesen.

## Lies zuerst
- `requirements.md` → §4.1 (Gemeinsames Modell, Grundy/NIM-Summe) und §3.2 (Grundy-Folgen je Regel).
- `architecture.md` → §2.1 (`nim.js` berechnet die Grundy-Tabelle `g[0..maxSteine]`).

## Ausgangszustand (Code, den du vorfindest)
- `nim.js` existiert und enthält bereits (aus Task 02):
  - `window.Nim = window.Nim || {};`
  - `Nim.parseAllowed(rule, ownList)` und `Nim.legalAmount(rule, A, amount, heapSize)`.
- Du **erweiterst** `nim.js` um die Grundy-Tabelle. Die restlichen `nim.js`-Funktionen
  (NIM-Summe, optimaler Zug) kommen in einer späteren Task — **mach sie hier nicht**.

## Ziel
In `nim.js` (unter `window.Nim`) die Funktion implementieren:

### `Nim.grundyTable(maxStone, A)` → `g[0..maxStone]` (Array von Längen `maxStone+1`)
- `g[0] = 0`.
- Für `n = 1..maxStone`: `g[n] = mex( { g[n - a] : a ∈ A, a ≤ n } )`.
  - **mex** = kleinste **nicht** in der Menge vorhandene nicht-negative Zahl.
- **Klassisch** (`A === null`): dann ist `g[n] === n`. Nutze am besten den Shortcut
  (direkt `g[n]=n`), das ist äquivalent zu mex über `1..n`.
- **Caching (optional, empfohlen):** Tabelle pro `(A, maxStone)` einmal berechnen
  und wiederverwenden, da die KI sie pro Stellung erneut anfragen wird.

## Relevante Vorgaben (Zusammenfassung)
- `g(0)=0`; `g(n)=mex{ g(n-a) : a ∈ A und a ≤ n }`; Tabelle `g[0..maxSteine]`
  **vorab einmal** berechnen. → `req §4.1`.
- Klassisch: `g(n)=n`. 4er-Nimm (`{1,2,3,4}`): `g(n)=n mod 5`.
  Eigene Liste: `g(n)` via mex-Rekursion. → `req §3.2`.
- `nim.js` bleibt **rein**, ES2020, keine Module, keine DOM-/UI-Bezüge. → `arch §2.1/§3.1`.

## Umsetzungshinweise
- Für den mex-Schritt: baue die Menge der erreichbaren Werte, zähle dann aufwärts
  ab 0, bis eine Zahl fehlt.
- Achte auf `a ≤ n` (nur Zug-Mengen, die den Haufen nicht negativ machen).
- Klassisch-Shortcut verhindert O(n·|A|) und ist exakt `g[n]=n`.
- `A` kann `null` (Klassisch) oder ein sortiertes Array sein (Task 02).

## Abnahmekriterien (überprüfbar – Konsole)
- [ ] Klassisch (`A=null`): `g[n] === n` für `n = 0..30`.
- [ ] 4er-Nimm (`A=[1,2,3,4]`): `g[n] === n % 5` für `n = 0..30`.
- [ ] Eigene Liste `A=[1,3,5]`: `g[0]=0`, `g[1]=1`, und `g[2]=0`
      (Prüfung: aus 2 nur `a=1` erlaubt → `g(1)=1`; mex{1} = 0).
- [ ] Eigene Liste `A=[2,3]` (ungültig nach Task 02, aber rein logisch):
      `g[1]` bleibt erreichbar? → hier nicht verlangt; Test optional.
- [ ] Keine Konsolenfehler; `Nim.grundyTable` existiert und die anderen Task-02
      Funktionen sind weiterhin intakt.

## Definition of Done
`Nim.grundyTable(maxStone, A)` liefert für alle drei Regeln korrekte Grundy-Werte
und ist performant genug für die spätere KI (Caching wünschenswert).
