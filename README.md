# Familienplaner

Ein Alltagsplaner für **genau zwei Menschen** (Constanze & Dirk): den gemeinsamen Apple-Kalender
bidirektional spiegeln, hinter jedem Termin die Vorbereitung und Absprache bündeln, und per KI
beim Planen der Woche helfen.

## Doku
- **[PLAN.md](./PLAN.md)** — Architektur, Datenmodell, Phasenplan, Risiken
- **[DECISIONS.md](./DECISIONS.md)** — Architekturentscheidungen (je 3 Sätze)
- **[DEPLOY.md](./DEPLOY.md)** — Sliplane-Deployment Schritt für Schritt
- **[design/DESIGN.md](./design/DESIGN.md)** — Design-System (aus den Screenshots destilliert)

## Stack
Next.js (App Router, TS) · PWA · Postgres + Prisma · Tailwind (OKLCH-Tokens) · motion.dev ·
Auth.js (Magic Link) · Anthropic API · CalDAV (tsdav/ical.js/rrule). Hosting: Sliplane (EU),
App + Worker aus einem Image.

## Lokal starten
```bash
cp .env.example .env      # Werte eintragen (mind. DATABASE_URL)
npm install
npm run prisma:generate
npm run dev               # App auf http://localhost:3000
npm run worker:dev        # Worker (Cron) separat
```

Design-Referenz während der Entwicklung: **http://localhost:3000/style**

## Status
- **Phase 0 ✓** — Fundament, Design-System, `/style`, Dockerfile, Worker, DEPLOY.md
- Phase 1 — CalDAV-Sync, Wochenansicht, Termin-Detail, Auth *(als Nächstes)*
