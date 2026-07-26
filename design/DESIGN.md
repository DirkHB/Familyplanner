# DESIGN.md — Visuelle Referenz

Abgeleitet aus den vier gelieferten Screenshots (`design/reference/01–04`). Diese Screens sind
die **kanonische Zielästhetik**. Jeder gebaute Screen wird gegen sie und gegen die Anti-Slop-Regeln
(Abschnitt 7 des Briefings) auditiert.

## Die zwei Nutzer (fest verdrahtet, keine Nutzerverwaltung)

| Person       | Rolle        | Avatar-Farbe            |
|--------------|--------------|-------------------------|
| **Dirk**     | Nutzer 1     | Dunkelblau `#111E33`    |
| **Constanze**| Nutzerin 2   | Rosé `#C08A86`          |

> Hinweis: Auf den Mockups stand „Marit" — reiner Platzhalter. Überall **Constanze** verwenden.

## Was die Screenshots festlegen

### Gemeinsam
- Warmes Beige `#F5EFE6` mit **kaum sichtbarer Grain-Textur** als Grundfläche, nie reines Weiß.
- Erhöhte Flächen (Cards, Sheets) in `#FBF7F1`, sehr weicher, richtungsgebundener Schatten.
- **Serif-Display** (Fraunces-Charakter) für: Begrüßung, Wochentage, Uhrzeiten, Zahlen, Sektionstitel.
  Uhrzeiten mit **Tabellenziffern**. Große Uhrzeit im Detail-Hero (z. B. `10:15`).
- **Sans** (Satoshi-Charakter) für: Termin-Titel (bold), Body, Buttons, Badges, Tab-Labels.
- **Uppercase, weit getrackte Labels** in gedämpfter Tinte: `MONTAG, 27. JULI`, `BRAUCHT DEINE ANTWORT`,
  `TERMIN-DETAIL`, Kategorie-Gruppen (`FRISCHES`, `BABY`, `HAUSHALT`).
- **Türkis `#12A594` extrem sparsam**: aktiver Tab, aktive Checks, ein Label pro Card, FAB `+`.
- **Rosé `#C08A86` / hell `#E8CFCB`**: Constanze-Avatar, „Betreuung offen", Herzchen, „Passt gut"-KI-Chips,
  Notizen-Block-Tint. Warmes Signal, nie Alarm.
- **Bottom-Tab-Bar**, 4 Ziele: Woche · Termine · Einkauf · Ideen. Aktives Ziel türkis mit Label.

### 01 · Diese Woche (Startbildschirm)
- Kopf: getracktes Datum-Label + große Serif-Begrüßung „Guten Morgen, Dirk".
- **„Braucht deine Antwort"**: dunkelblaue Card, türkis-Label, Serif-Frage, kleiner warmer Status-Dot,
  Absender + Zeit („Constanze fragt · vor 20 Min."), zwei **große** Buttons
  (türkis „Ja, mache ich" + gedämpft „Geht nicht"). In <5 s beantwortbar.
- Tagesgruppen: Serif-Wochentag links, dünne Linie, Datumszahl rechts.
- Event-Card: Uhrzeit (Serif, links) · dünner Trenner · Titel (bold) · Avatar-Dot(s) ·
  Status-Badge („Betreuung geklärt" türkis-hell / „Betreuung offen" rosé / „Constanze ist da").

### 02 · Termin-Detail
- **Dunkelblauer Hero**: türkis Datum, Serif-Titel, riesige Uhrzeit (tabellar), Ort mit Pin + Fahrtzeit.
- **„Wer ist beim Baby"**-Card: Zeitfenster-Chip (türkis-hell, Uhr-Icon), zwei Avatare mit Namen.
- **Vorbereitung**-Card: Fortschritt `2 / 5`, erledigte Punkte türkis-Check + durchgestrichen/gedämpft,
  offene Punkte leerer Ring + volle Tinte.
- **Notizen**-Block: rosé-getönte Fläche, Stift-Icon, Freitext.

### 03 · Einkaufsliste
- Serif-Titel, Avatare + „Gemeinsam mit Constanze · 4 offen".
- Kategorie-Gruppen (türkis-uppercase). Item: Check-Ring links, Text, Avatar-Dot rechts (wer hinzugefügt).
- Abgehakt = türkis-Check + durchgestrichen. **Abhaken animiert minimal** (100×/Tag-Regel).
- Unten fixiert: Eingabe „Was fehlt noch?" + türkis FAB `+`.

### 04 · Ideen & Urlaub
- Serif-Titel + gedämpfte Unterzeile. Foto-Cards (echtes Foto, gerundet), Titel Serif, Meta gedämpft.
- Herz mit Funken-Akzent (rosé), Avatar-Dots. **KI-Chip „Passt gut: 12.–14. September"** in rosé-Tint,
  Funken-Icon — klar als KI-Vorschlag markiert.

## Motion (motion.dev)
- Nur `transform`/`opacity`. Ease-out fürs Eintretende, Spring für Finger-Gesten. 100–400 ms.
- Abhaken/häufige Aktionen: minimal oder gar nicht. Belohnungsmoment nur bei „Anfrage beantwortet"
  und „Liste komplett" — dezent, kein Konfetti. `prefers-reduced-motion` überall.

## Audit-Checkliste pro Screen (Impeccable/Taste/Emil, fest verankert)
1. **Eine** visuelle Hauptsache? Türkis nur an wenigen Stellen?
2. Wichtigste Aktion ohne Scrollen, großes Ziel, unteres Drittel?
3. Max. drei Textgrößen, 4er-Raster, Tabellenziffern bei Zahlen?
4. Kein Slop: kein Glassmorphism/Bento/Emoji-UI/Verlauf/richtungsloser Schatten?
5. Warme Neutrale, kein reines Schwarz/Weiß, Grain kaum sichtbar?
6. Einhändig um 3 Uhr nachts bedienbar, ohne Erklärung?
