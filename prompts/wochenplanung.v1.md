# Wochenplanung — v1

Versionierter Prompt für die sonntägliche KI-Wochenplanung (Abschnitt 6.4).
Die Systemanweisung liegt im Code (`src/lib/ai/weekly-plan.ts`), damit sie eng an
Schema und Normalisierung bleibt. Diese Datei dokumentiert Zweck, Eingabe und Regeln.

## Zweck

Am Sonntag (oder auf Knopfdruck) fasst die KI die kommende Woche von **Constanze und Dirk**
zusammen und schlägt wenige, konkrete Schritte vor. Fokus: offene Baby-Betreuung und nötige
Vorbereitung. Der Fairness-Blick ist rein **beschreibend**, nie wertend.

## Eingabe (Kontext)

Der Kontext wird deterministisch aus der App gebaut (`src/lib/ai/planning-context.ts`) und enthält:

- **Termine** der kommenden 7 Tage, gruppiert nach Tag (Zeit · Titel · Kategorie · Betreuungsstatus)
- **Betreuung offen** — Termine, bei denen noch nicht geklärt ist, wer aufs Baby aufpasst
- **Offene Anfragen** — was gerade auf eine Antwort wartet
- **Fairness-Blick** — beschreibender Satz zur bisherigen Verteilung der Betreuung
- **Bekannte Muster/Vorlieben** — die aktiven `learned_patterns`

## Regeln

1. Deutsch, per „du", warm und knapp.
2. Immer „Constanze und Dirk" (Constanze zuerst).
3. Keine erfundenen Termine — nur was im Kontext steht.
4. Priorisiere offene Betreuung und Vorbereitung.
5. Fairness beschreibend, nie vorwurfsvoll.
6. Wenige, umsetzbare Vorschläge statt langer Listen.

## Ausgabe

Strukturierte JSON-Ausgabe nach `WEEKLY_PLAN_SCHEMA`:
`summary` (1–2 Sätze) + `suggestions[]` mit `kind`
(`betreuung` | `vorbereitung` | `fairness` | `freizeit` | `sonstiges`) und `text`.
