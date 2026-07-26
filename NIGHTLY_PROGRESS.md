# Nacht-Build — Fortschritt

Autonomer Loop über Nacht (26./27.07.). Ziel: App phasenweise fertigbauen, jeden Baustein
committen/pushen, Secrets für morgen sammeln (→ `SECRETS_NEEDED.md`).

**Grundregeln, die ich einhalte:** immer „Constanze und Dirk"; keine Secrets im Code; Sync/
Wiederholungen/Erinnerungen bekommen Tests; jeder Commit lässt `next build` grün; Design nach
`design/DESIGN.md`.

**Testbarkeit:** Kein lokaler Postgres in der Build-Umgebung → pure Logik wird mit Vitest
unit-getestet; DB-Code über `prisma validate` + `tsc` + `next build` abgesichert. Echte
DB-Integrationstests laufen gegen die Sliplane-Postgres (Prod).

---

## Phasenplan & Status

### Phase 1 — MVP-Kern
- [x] Test-Infrastruktur (Vitest) — `npm test`
- [x] Verschlüsselung (Envelope, AES-256-GCM) + Tests (6)
- [x] Auth.js v5: Magic Link (Resend) + Allowlist + Prisma-Adapter, lange Sessions (1 Jahr)
- [x] Prisma-Schema um Auth-Modelle erweitern + Migration (17 Tabellen)
- [ ] CalDAV-Client hinter Interface (tsdav) + Fixtures
- [ ] iCal-Parsing + Wiederholungen (ical.js/rrule): RRULE/EXDATE/RECURRENCE-ID + Tests
- [ ] Sync-Engine: Pull (sync-collection→CTag/ETag), Push (PUT If-Match, 412-Merge) + Konfliktlogik + Tests
- [ ] Datenzugriff (Repositories) für events/event_details
- [ ] Wochenansicht (Startbildschirm) nach Mockup
- [ ] Termin-Detail (Notizen) nach Mockup
- [ ] Settings: Sync-Status (letzter Lauf/Fehler, „Jetzt synchronisieren")
- [ ] Worker: echten Sync-Job einhängen
- [ ] Rate-Limiting auf API-Routen

### Phase 2 — Betreuung, Anfragen, Push
- [ ] Baby-Betreuung (care_assignments), Auto-Anfrage bei „offen"
- [ ] Anfragen (yes_no/choice/free_text/date), oben angepinnt
- [ ] Täglicher Nudge (09:00) + Eskalation (E-Mail nach 3 Tagen, rot nach 7) + Tests
- [ ] Web Push (VAPID) + Ruhezeiten (Nachtfenster) + Tests
- [ ] Antwort in <5 s (aus Push / ein Tap)

### Phase 3 — Listen, Checklisten, Offline
- [ ] Einkaufslisten (Haupt + terminbezogen), Kategorien, Live-Sync
- [ ] Vorbereitungs-Checklisten (+ KI-Vorschläge je Kategorie)
- [ ] Offline-Fähigkeit (Abhaken offline, später sync)

### Phase 4 — KI
- [ ] Prompt-Verzeichnis `/prompts` (versioniert)
- [ ] Kontextaufbau (Woche + learned_patterns + offene Anfragen + Kategorien)
- [ ] Schnellerfassung (NL → Terminvorschlag, Vorschau)
- [ ] Wochenplanung (Sonntag), Fairness-Blick (deskriptiv)
- [ ] learned_patterns (lesbar/editierbar im UI)
- [ ] ai_feedback bei jeder Aktion

### Phase 5 — Ideen & Urlaub
- [ ] Ideen-Board (Foto-Cards nach Mockup), Bewertung
- [ ] KI-Konkretisierung (Zeitfenster, „Passt gut"), Idee → Termin

---

## Log (neueste oben)
- _(Start)_ Loop eingerichtet, Nacht-Plan angelegt.
- Iteration 1: Test-Infra, Envelope-Crypto (+6 Tests), Auth.js Magic-Link + Allowlist (+4 Tests), Auth-Migration. Landing/style bleiben oeffentlich, App-Routen gated.
