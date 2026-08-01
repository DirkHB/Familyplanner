# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Constanze und Dirk — ein Paar mit einem Baby, Nicolas. Beide sind
gleichberechtigte Nutzer; es gibt keine Administrator-Rolle, keine Kundschaft
und keine Gäste.

Die Situation der Nutzung ist selten der Schreibtisch: zwischen Betreuung,
Arbeit und Haushalt, im Stehen oder Gehen, häufig mit Nicolas auf dem Arm und
deshalb mit einer Hand. Die Aufgabe, die sie dabei erledigen, ist fast nie
„nachsehen, wann etwas ist", sondern „klären, wer was übernimmt".

## Product Purpose

Die Kopfarbeit aus einem Kopf herausholen: vorausdenken und nachhalten.

Termine anzeigen kann Apple Kalender. Diese App macht sichtbar, was noch zu
entscheiden ist, und hält fest, wer was übernommen hat — damit es niemand mehr
im Kopf behalten muss.

Erfolg ist genau das und nichts anderes: **Constanze und Dirk müssen weniger im
Kopf behalten.** Nutzungshäufigkeit ist kein Ziel, sondern höchstens ein
Symptom.

## Positioning

Ein geteilter Kalender zeigt Termine. Diese App beantwortet die Fragen
dahinter — wer ist in dieser Zeit bei Nicolas, was ist noch offen, wer macht
was — und schreibt dafür in beide Richtungen mit dem bestehenden
iCloud-Kalender, statt einen zweiten Ort zu verlangen, den jemand pflegen muss.

## Operating Context

- **Ein geteilter Kalender für alles.** Constanze und Dirk tragen private wie
  berufliche Termine in denselben iCloud-Kalender „C & D" ein, damit der andere
  Bescheid weiß (~1900 Termine). Persönliche Kalender werden praktisch nicht
  gepflegt. Daraus folgt eine harte Konsequenz: Der Kalender allein sagt nicht,
  wen ein Termin bindet — echte Terminkonflikte sind nicht ableitbar, die Frage
  „wer ist bei Nicolas?" dagegen schon.
- **Installierte PWA auf dem iPhone**, im Alltag nebenbei bedient.
- **Push ist der Weg nach draußen.** Wer die App nicht öffnet, soll trotzdem
  erfahren, was ihn betrifft. Nachts (21–7 Uhr) ist Ruhe.
- **Rituale:** Morgen-Briefing um 7:00, Wochenüberblick sonntags 12:00,
  Klärungs-Stapel beim Öffnen der Woche.

## Capabilities and Constraints

- Zwei-Wege-Sync mit iCloud über CalDAV: Anlegen, Ändern und Löschen wirken im
  Apple Kalender.
- Serientermine werden in der App bewusst **nicht** bearbeitet — Ausnahmen und
  Verschiebungen sind zu fehleranfällig; Änderungen passieren in Apple Kalender
  und kommen per Sync zurück.
- Betreuung wird je Termin-Vorkommen und Tag festgehalten. Ein „dafür braucht es
  nie eine Betreuung" gilt pro Titel-Art, nicht pro Vorkommen.
- Weitere Bereiche: Aufgaben, Einkauf, Ideen, KI-Briefings (Anthropic,
  ausschließlich serverseitig).
- Anmeldung per E-Mail-Link, Zugang über eine Allowlist.
- Betrieb: Sliplane (EU), Datenbank Neon (Frankfurt), eigener Worker für Sync,
  Erinnerungen und Briefings.
- **Offene Produktentscheidung:** Der Nutzerkreis soll offen gehalten werden.
  Mandantentrennung wird heute nicht gebaut, aber künftige Arbeit soll keine
  neuen fest verdrahteten Annahmen über „genau diese zwei Personen" schaffen.

## Brand Commitments

- Name „Familienplaner", Domain planyourweek.app.
- **Deutsch, per „du".** Kurz und warm, keine Software-Sprache.
- Personen immer in der Reihenfolge **„Constanze und Dirk"**.
- Die Oberfläche spricht zwei Menschen an, die sich kennen — kein Produkt-Ton,
  keine Anrede an Kundschaft.

## Evidence on Hand

- Echte Kalenderdaten im Betrieb: 3 angebundene Kalender, ~1901 Termine im
  geteilten Kalender.
- Gemessen an diesen Daten: Bei 16 Terminen (0,8 %) ist ein Ersteller
  hinterlegt, 403 (21 %) tragen einen Namen im Titel. Zuordnung „wer ist
  gebunden" ist daher überwiegend nicht automatisch ableitbar.
- Keine Testimonials, Nutzerzahlen, Benchmarks, Preise oder Auszeichnungen. Die
  App ist nicht öffentlich; nichts davon darf erfunden oder angedeutet werden.

## Product Principles

1. **Weniger im Kopf, nicht mehr in der App.** Jede Funktion muss Kopfarbeit
   abnehmen. Wer dafür Pflegearbeit hinzufügt, hat verloren.
2. **Nur fragen, wenn die Antwort etwas ändert** — und die Antwort dann pro
   Termin-Art merken, nicht pro Vorkommen.
3. **Die App mahnt, nicht der Partner.** Das Nachhalten gehört ins System, nicht
   zwischen zwei Menschen.
4. **Einhändig bedienbar.** Jede Kernaktion muss mit einem Daumen erreichbar
   sein, jede Wischgeste eine sichtbare Alternative haben.
5. **Keine Sackgassen.** Weder beim Nutzerkreis noch bei den Daten: Apple
   Kalender bleibt vollwertig nutzbar, auch ohne diese App.

## Accessibility & Inclusion

Einhändige Bedienung ist eine bestätigte, dauerhafte Anforderung (Baby auf dem
Arm): Kernaktionen im Daumenbereich, Wischgesten immer mit Knopf-Alternative,
Bestätigungen ohne Zielgenauigkeit. Darüber hinaus wurde keine
produktspezifische Anforderung festgelegt.
