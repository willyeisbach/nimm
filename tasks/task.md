# NIM – Implementierungs-Tasks (Version 1, End-to-End)

**Kurzer Index** über die 16 selbsterklärenden Task-Dateien in diesem Ordner
(`task-01.md` … `task-16.md`). Jede Task-Datei enthält alles, was eine KI zum
Abarbeiten braucht: Lesevorgaben (`architecture.md` / `requirements.md`),
**Ausgangszustand** (den Code, den die KI vorfindet), Ziel, relevante Vorgaben,
Umsetzungshinweise, Abnahmekriterien und Definition of Done —
**ohne dass andere Task-Dateien gelesen werden müssen**.

**Aufbau (Bottom-up, der Abhängigkeitsrichtung `nim.js → ai.js → game.js` folgend):**

| Phase | Tasks   | Ergebnis                                                                 |
| ----- | ------- | ------------------------------------------------------------------------ |
| 0     | 1       | Läuft per Doppelklick (`file://`), leere, fehlerfreie Hülle              |
| 1     | 2, 3, 4 | `nim.js` rein & per Konsole testbar                                      |
| 2     | 5, 6, 7 | `ai.js` rein & per Konsole testbar                                       |
| 3     | 8 … 14  | `game.js`: Zustand, UI, Animation, Optionen, KI-Anschluss                |
| 4     | 15, 16  | Barrierefreiheit/Responsiveness + Abnahme (`requirements §8`, `arch §5`) |

> **Konvention:** „Konsole-Test" heißt: Datei in `index.html` geladen, DevTools →
> Console, Funktion direkt aufrufen (s. `architecture.md §3.8`). „Sichtprüfung"
> heißt: `index.html` per Doppelklick öffnen und im Browser abgleichen.

## Definition of Done (gilt für jede Task)

Eine Task gilt als erledigt (✅), wenn **alle** folgenden Punkte erfüllt sind:

- Alle **Abnahmekriterien** der jeweiligen Task-Datei sind erfüllt.
- Die **taskspezifische Definition of Done** der jeweiligen Task-Datei ist erfüllt.
- Falls **Linter/Formatter** genutzt wurden: keine offenen Befunde,
  Formatierung ist sauber (keine Lint-/Format-Fehler).
- Der **Status** in dieser Datei (`tasks/task.md`) ist aktualisiert
  (Zeile der Task auf ✅, „Fortschritt"-Zähler hochgezählt).
- Die Task ist **committet** (Commit enthält Code-Änderungen
  **und** die Status-Aktualisierung in `tasks/task.md`).

## Task-Index

> **Status-Legende:** ✅ erledigt · ⬜ offen · 🚧 in Arbeit

| #   | Datei        | Phase | Kurzbeschreibung                                                        | Abhängig von        | Status |
| --- | ------------ | ----- | ----------------------------------------------------------------------- | ------------------- | ------ |
| 1   | `task-01.md` | 0     | Projektgerüst: 5 Dateien, Skript-Reihenfolge, läuft per `file://`       | –                   | ✅     |
| 2   | `task-02.md` | 1     | `nim.js`: Zugregel-Parser (`parseAllowed`, `legalAmount`)               | 1                   | ✅     |
| 3   | `task-03.md` | 1     | `nim.js`: Grundy-Tabelle via mex                                        | 2                   | ✅     |
| 4   | `task-04.md` | 1     | `nim.js`: NIM-Summe, Legitimität, optimaler & zufälliger Zug            | 2, 3                | ✅     |
| 5   | `task-05.md` | 2     | `ai.js`: Baxi (immer optimal)                                           | 4                   | ✅     |
| 6   | `task-06.md` | 2     | `ai.js`: Ducola (großzügig früh, optimal spät)                          | 4, 5                | ✅     |
| 7   | `task-07.md` | 2     | `ai.js`: Muisa (zufällig früh, optimal spät)                            | 4, 5                | ✅     |
| 8   | `task-08.md` | 3     | `game.js`: Spielzustand, Defaults, Haufengenerierung, `start()`         | 2                   | ✅     |
| 9   | `task-09.md` | 3     | `game.js`: Rendering (Haufen, Steine, Status)                           | 8                   | ✅     |
| 10  | `task-10.md` | 3     | `game.js`: Haufen-Auswahl, Input-Validierung, Button-Enable             | 9                   | ✅     |
| 11  | `task-11.md` | 3     | `game.js` + `style.css`: Blink-Animation, Stein-Entfernung, Zugsperrung | 10                  | ✅     |
| 12  | `task-12.md` | 3     | `game.js`: Zugübergabe, Sieg-Erkennung, „Neues Spiel"                   | 11                  | ✅     |
| 13  | `task-13.md` | 3     | `index.html` + `game.js`: Options-Dialog (Zahnrad)                      | 2, 8                | ✅     |
| 14  | `task-14.md` | 3     | `game.js`: KI-Anschluss (auto-Zug + Denk-Delay)                         | 5, 6, 7, 11, 12, 13 | ✅     |
| 15  | `task-15.md` | 4     | Veredelung: Barrierefreiheit, Responsive, Fehler-Hygiene                | 9–14                | ✅     |
| 16  | `task-16.md` | 4     | Endabnahme E2E (`req §8` + `arch §5`)                                   | 1–15                | ✅     |

> **Fortschritt:** 16 / 16 erledigt.

> **Abarbeitungs-Hinweis:** Reihenfolge 1 → 2 → … → 16. Tasks 5–7 (KI)
> können parallel zu den UI-Tasks 8–13 abgearbeitet werden, da sie nur
> von `nim.js` (Task 4) abhängen. Kritischer Pfad:
> `1 → 2 → 3 → 4 → 8 → 9 → 10 → 11 → 12 → 14 → 15 → 16`.

## Abhängigkeitsgraph (Kurzform)

```
1
└─ 2 ─┬─ 3 ─┬─ 4 ─┬─ 5 ─┬─ 8 ─┬─ 9 ─ 10 ─ 11 ─ 12 ─ 14 ─ 15 ─ 16
      │     │      │      │     └─ 13 ──────┘     │
      │     └──────┴──────┴── 6 ──────────────────┤
      │                 └──── 7 ──────────────────┤
      └────────────────────────────────────────────┘
```

Kritischer Pfad: `1 → 2 → 3 → 4 → 8 → 9 → 10 → 11 → 12 → 14 → 15 → 16`.
Tasks 5/6/7 (KI) können parallel zu den UI-Tasks 8–13 abgearbeitet werden,
da sie nur von `nim.js` (Task 4) abhängen und `game.js` in Task 14 anbindet.
