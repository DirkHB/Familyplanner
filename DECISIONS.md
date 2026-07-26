# DECISIONS.md

Jede Architekturentscheidung in 3 Sätzen. Neueste oben.

---

## D-001 — Zwei Services (App + Worker) aus einem Repo, kein Redis
Wir trennen die zeitgesteuerte Arbeit (CalDAV-Sync, Nudges, Wochenreview) in einen eigenen
node-cron-Worker, damit ein hängender Sync die UI nie blockiert und ein Worker-Absturz die App
nicht mitreißt. Beide Services teilen sich Code und Postgres, unterscheiden sich nur im
Start-Command, laufen auf demselben Sliplane-Server (kein Aufpreis pro Container). Redis oder eine
externe Queue wären für zwei Nutzer Overengineering — Postgres deckt alles ab.

## D-002 — CalDAV hinter einem Interface, fixtures-first entwickelt
Der iCloud-Zugriff wird hinter `CalDavClient` gekapselt und zuerst gegen echte `.ics`-Fixtures mit
automatisierten Tests gebaut (RRULE, EXDATE, RECURRENCE-ID, 412-Konflikte). So entstehen keine
Zugangsdaten-Risiken in der Entwicklung und der teuerste Fehlerbereich ist testbar. Echte
App-spezifische Passwörter kommen erst beim Phase-1-Deploy über verschlüsselte DB-Felder hinein.

## D-003 — Zusatzdaten hängen an der iCalendar-UID
Unsere App-eigenen Daten (Checkliste, Betreuung, Anfragen) werden über die stabile iCalendar-UID
verknüpft, nicht über DB-ID oder href, weil iCloud href/etag bei Änderungen wechseln kann. Bei
Kollisionen gilt: iCloud ist Wahrheit für Kalenderfelder, die App für Zusatzdaten. Echte Konflikte
lösen wir mit last-write-wins plus Protokolleintrag und sichtbarer UI-Info — nie stiller Datenverlust.

## D-004 — Design-Skills-Regeln fest verankert statt Skill-Abhängigkeit
Die Skills Impeccable, Emil Kowalski und Taste sind in dieser Umgebung nicht installierbar, deshalb
gießen wir ihre Kernprinzipien (Anti-Slop, Motion-Grammatik, gute Vorbilder) fest ins Design-System
und in eine `/style`-Referenzseite. Jeder Screen wird manuell gegen eine audit/critique/polish-Checkliste
geprüft, bevor er als fertig gilt. Wenn die Skills lokal eingerichtet werden, ziehen wir die Umsetzung nach.
