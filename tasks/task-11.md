# Task 11 – `game.js`: Blink-Animation, Stein-Entfernung & Zugsperrung

> **Wichtig für dich (KI):** Lies vor Beginn **`architecture.md`** §2.1, §3.2, §3.5
> und **`requirements.md`** §5.5. Diese Datei ist **selbsterklärend**: Du brauchst
> nur sie, die zwei Docs und den unten beschriebenen **Codestand** —
> **keine anderen Task-Dateien** lesen.

## Lies zuerst
- `requirements.md` → §5.5 (Animation: Steine blinken, dann verschwinden).
- `architecture.md` → §3.2 (Blink-Animation, `animationend`/`setTimeout`), §3.5 (CSS `@keyframes blink`), §3.7 (Zugsperrung).

## Ausgangszustand (Code, den du vorfindest)
- `index.html` + `style.css` (mit Grundstyling; ggf. bereits `.heap`, `.stone`).
- `game.js` enthält bereits (aus Task 08–10): `Game.state` (inkl. `lock`),
  `Game.start()`, `Game.render()`, Auswahl + Validierung + Button-Enable.
- `Game.state.lock` existiert bereits (aus Task 08) und ist `false`.
- Du **erweiterst** `game.js` um die Animation/Entfernung und **`style.css`**
  um das `@keyframes blink`.

## Ziel

### `style.css`
- `@keyframes blink { 0%, 100% { opacity: 1 } 50% { opacity: 0.15 } }`
- `.stone.blinking { animation: blink 0.6s ease-in-out 2; }`
  (≈ 3–4 Blips, insgesamt ~1.2 s; passt zu `req §5.5` „3–4 Blips / ~600–800 ms"
  pro Blip-Durchgang).

### `game.js`
Implementiere `Game.animateAndRemove(heapIdx, amount)`:
1. Setzt **`Game.state.lock = true`**.
2. Markiert die **letzte `amount` Steine** des Haufens `heapIdx` mit
   `.blinking` (die zu entfernenden — „oben"/recht, je nach Rendering;
   konsistent mit dem, was du in Task 09 rendert).
3. Wartet bis `animationend` **oder** `setTimeout(~1300 ms)` (Fallback),
   dann:
   - Entfernt genau diese `amount` Steine aus dem DOM (Haufen-Größe wird
     in `Game.state.heaps[heapIdx]` um `amount` reduziert).
   - Entfernt die `.blinking`-Klasse von allen (Säuberung).
   - Setzt **`Game.state.lock = false`**.
   - Ruft `Game.render()` (bzw. aktualisiert den Haufen) auf.
   - Ruft den **Callback** auf (in Task 12: Zugübergabe/Sieg-Check).

### Zugsperrung
- Während `Game.state.lock === true` **müssen** alle Eingabepunkte blockiert sein:
  - Button „Ziehen" disabled.
  - Haufen-Klicks ignoriert.
  - Input-Feld ignoriert (oder `readonly`).
- Prüfe `lock` an **allen** Eingabestellen (Klick-Listener, Input-Handler).

## Relevante Vorgaben (Zusammenfassung)
- Zu entfernende Steine **blinken** kurz (3–4 Blips / ~600–800 ms,
  CSS-Klasse `blinking`, Opacitätswechsel), danach verschwinden sie;
  währenddessen Eingabe + Button **gesperrt**. → `req §5.5`.
- `@keyframes blink` + `animation: blink 0.6s ease-in-out 2`. → `arch §3.5`.
- `animationend`-Event **oder** `setTimeout(800)`; `Game.lock = true`
  während KI-Zug / Animation; alle Eingabepunkte prüfen das Flag. → `arch §3.2/§3.7`.

## Umsetzungshinweise
- Verwende `animationend` als primären Trigger und `setTimeout` als
  Safety-Net (falls `animationend` nicht feuert, z. B. bei reduzierter
  Animations-Hardware).
- „Welche Steine entfernen": nutze die letzten `amount` Spans im Haufen
  (oder die ersten — Hauptsache konsistent mit `render()`).
- Halte `lock`-Checks zentral — eine kleine `Game.isLocked()`-Helper.

## Abnahmekriterien (überprüfbar – Sichtprüfung/Konsole)
- [ ] Zug ausführen → **nur die genommenen** Steine blinken, danach verschwinden;
      die verbleibenden Steine bleiben unverändert.
- [ ] Während des Blinks: Button „Ziehen" **disabled**, Haufen-Klicks **ignoriert**,
      Input reagiert nicht (kein Doppelzug).
- [ ] Konsolentest: `Game.animateAndRemove(0, 3)` → `Game.state.lock` ist
      während Animation `true`, danach `false`; Haufen-Größe wurde um 3 reduziert.
- [ ] `animationend`-Event feuert (DevTools → Event-Listener prüfen) **oder**
      `setTimeout` greift — in beiden Fällen entfernen sich die Steine.
- [ ] Nach der Animation: `Game.render()` wurde aufgerufen, DOM ist konsistent
      mit `Game.state.heaps`.
- [ ] Keine Konsolenfehler.

## Definition of Done
`Game.animateAndRemove(heapIdx, amount)` blinkt die zu entfernenden Steine,
entfernt sie korrekt, sperrt währenddessen **alle** Eingaben und gibt danach
`lock` frei — bereit für die Zugübergabe in Task 12.
