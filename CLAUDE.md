# Familienplaner — Projektgedächtnis

## Die Menschen (wichtig, bitte nie verwechseln)

- **Constanze** — meine Frau
- **Dirk** — ich (dirkbrederecke@gmail.com)
- **Nicolas** — unser Sohn, Baby

Immer in dieser Reihenfolge schreiben: **„Constanze und Dirk"**, nie umgekehrt.
Nicht „Marit", nicht „Leo" — die Namen sind Constanze, Dirk und Nicolas.

## Ton

Deutsch, per „du". Die App ist für genau zwei Menschen, nicht für Kundschaft.
Texte in der Oberfläche kurz und warm, keine Software-Sprache.

## Was die App ist

PWA für Constanze und Dirk: gemeinsamer iCloud-Kalender (CalDAV, in beide
Richtungen), Betreuung für Nicolas absprechen, Aufgaben, Einkauf, Ideen,
KI-Briefings. Zweck ist nicht „Termine anzeigen" — das kann Apple Kalender —
sondern die Kopfarbeit aus einem Kopf herausholen: vorausdenken und nachhalten.

## Betrieb

- Hosting Sliplane (EU), Domain planyourweek.app, Datenbank Neon (Frankfurt).
- Zwei Services aus **einem** Image: App (`sh start.sh`) und Worker
  (CMD-Override `node worker/index.mjs`).
- Bei der App muss der CMD-Override **leer** bleiben — `start.sh` macht
  Migration und Serverstart. Sliplane führt Overrides nicht über eine Shell aus,
  ein `&&` käme als Argument bei Prisma an.
- Feld „Dockerfile Path" muss `Dockerfile` enthalten, sonst baut Sliplane mit
  Railpack am Dockerfile vorbei.
- Jeder Service braucht einen HTTP-Healthcheck, sonst Redeploy-Schleife.
  Pfad ist `/api/health` (ohne Datenbank, ohne Session).
- Das Runner-Image bleibt schlank: Der Builder wirft nach dem Bauen die
  Dev-Abhängigkeiten sowie `@next` und `next` weg. Ohne das war das Image zu
  groß und das Ausrollen scheiterte an „no space left on device".

## Regeln

- **Keine Geheimnisse im Code.** Lokal `.env`, in Produktion die
  Sliplane-Umgebungsvariablen.
- Vor jedem Push: `npx tsc --noEmit`, `npm run build`, `npx vitest run`.
- Größere Änderungen erst als Vorschlag, dann bauen — nicht ungefragt
  ausrollen.

## Fallstricke, die uns schon Zeit gekostet haben

- **Serientermine:** Wird in Apple Kalender ein einzelnes Vorkommen umbenannt,
  liegt das als Ausnahme (RECURRENCE-ID) im selben .ics. Die Spalte `title`
  trägt weiter den Serientitel. Kopfdaten deshalb immer aus dem **Vorkommen**
  nehmen (`occurrence-pick.ts`), nie aus der Spalte.
- **iOS-PWA:** `position: fixed` löst sich beim Gummiband-Scrollen vom
  Viewport. Deshalb die feste Hülle mit eigenem Scrollcontainer (`AppShell`).
- Weil der Inhaltsbereich scrollt und nicht das Dokument, greift die
  Scroll-Wiederherstellung des Browsers nicht — die Hülle führt selbst Buch
  (`scroll-memory.ts`).
- Waagerechte Wisch-Gesten brauchen `touch-action: pan-y`, sonst schiebt der
  Browser die Seite nebenher mit.
- Zeitzone Europe/Berlin: Tagesgrenzen über einen Mittags-Anker rechnen, sonst
  kippt es in der Sommerzeit um einen Tag.
