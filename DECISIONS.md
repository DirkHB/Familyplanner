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

## D-008 — Font-Paarung final: Fraunces + Geist (beide OFL, selbst gehostet)
Dirk hat sich für **Fraunces (Display) + Geist (Body)** entschieden; beide sind OFL und über npm/Fontsource
selbst gehostet, damit entfällt der Fontshare-Font Satoshi samt manuellem Drop-in komplett. Wir haben die
Satoshi-`@font-face`-Regel und `public/fonts/satoshi/` entfernt; der `/style`-Switcher behält Vergleichs-
paarungen (Instrument Serif + Geist, Fraunces + Hanken). Kein Google-CDN, DSGVO-konform, kein externer Download nötig.

## D-007 — Fonts über npm/Fontsource selbst gehostet (Historie)
Der Egress-Proxy blockt beliebige Hosts (GitHub-Raw, Fontshare), erlaubt aber die npm-Registry, deshalb
beziehen wir Fraunces, Instrument Serif und Geist als OFL-Pakete über Fontsource und hosten die woff2
selbst (kein Google-CDN, DSGVO-konform). Satoshi war zunächst als Fontshare-Drop-in geplant — durch D-008 überholt.

## D-006 — Ein Docker-Image für App und Worker, standalone plus gezielte Worker-Pakete
Wir bauen ein einziges Multi-Stage-Image mit Next.js `output: "standalone"` und starten daraus beide
Sliplane-Services über unterschiedliche Commands (`node server.js` bzw. `node worker/index.mjs`). Weil
das schlanke standalone-`node_modules` die Worker-Laufzeit und die Migrations-CLI nicht mitträgt, kopieren
wir gezielt `@prisma`, `.prisma`, `prisma`, `node-cron` und `uuid` nach. Migrationen laufen idempotent per
`prisma migrate deploy` im App-Start-Command, nicht als separater, vergessbarer Schritt.

## D-005 — Screenshots sind die kanonische Design-Referenz; Nutzer sind Dirk und Constanze
Die vier gelieferten Mockups (`design/reference/`) legen die Zielästhetik verbindlich fest und sind
in `design/DESIGN.md` als Design-System destilliert (Farbeinsatz, Typo-Rollen, Komponenten, Motion).
Die beiden fest verdrahteten Nutzer sind Dirk (Avatar Dunkelblau `#111E33`) und Constanze (Avatar Rosé
`#C08A86`); der Name „Marit" auf den Mockups war reiner Platzhalter und wird durchgängig durch Constanze ersetzt.

## D-004 — Design-Skills-Regeln fest verankert statt Skill-Abhängigkeit
Die Skills Impeccable, Emil Kowalski und Taste sind in dieser Umgebung nicht installierbar, deshalb
gießen wir ihre Kernprinzipien (Anti-Slop, Motion-Grammatik, gute Vorbilder) fest ins Design-System
und in eine `/style`-Referenzseite. Jeder Screen wird manuell gegen eine audit/critique/polish-Checkliste
geprüft, bevor er als fertig gilt. Wenn die Skills lokal eingerichtet werden, ziehen wir die Umsetzung nach.
