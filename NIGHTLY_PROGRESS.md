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
- [x] CalDAV-Client hinter Interface + tsdav-Impl (noch nicht gegen echtes iCloud verifiziert)
- [x] iCal-Parsing + Wiederholungen (ical.js): RRULE/EXDATE/RECURRENCE-ID + Tests (8)
- [x] Sync-Diff (Pull-Reconciliation, Push-Konflikt-Erkennung) + Tests (7)
- [x] Sync-Engine an DB (Pull upsert/delete, Konfliktprotokoll, Sync-Status pro Kalender)
- [x] Datenzugriff (Repositories) für events/event_details
- [x] Wochenansicht (Startbildschirm) nach Mockup + öffentliche Vorschau (/vorschau/woche)
- [x] Termin-Detail (Notizen editierbar) nach Mockup + Vorschau (/vorschau/termin)
- [x] Format/Kategorien/View-Model (Europe/Berlin) + Tests (5)
- [x] Tab-Bar (Woche/Termine/Einkauf/Ideen)
- [x] Settings: iCloud verbinden, Kalender-Toggles, Sync-Status, „Jetzt synchronisieren"
- [x] Worker: echter Sync-Job (Trigger via internem Endpunkt + WORKER_SECRET)
- [x] Push-Weg App→iCloud: ICS-Builder (Round-Trip-Tests) + createEvent (PUT) — „Übernehmen" legt real an
- [ ] Rate-Limiting auf API-Routen

### Phase 2 — Betreuung, Anfragen, Push  ✓ abgeschlossen
- [x] Baby-Betreuung (care_assignments) am Termin, „Ich mache es" / Auto-Anfrage bei „offen"
- [x] Anfragen (yes_no/choice/free_text/date), „Braucht deine Antwort"-Hero oben angepinnt
- [x] Nudge-/Eskalationslogik (Push täglich, E-Mail ab 3 T., rot ab 7 T.) + Tests (7)
- [x] Antwort in <5 s (ein Tap aus dem Hero) + Anfragen-Seite (erstellen/Verlauf)
- [x] Täglicher Nudge-Job (09:00): Push + E-Mail-Eskalation, Ruhezeiten beachtet, lastNudgeAt
- [x] Web Push (VAPID): Versand, Subscribe-Route, SW-Push/Click, Aktivieren-Button in Settings
- [x] Ruhezeiten (Nachtfenster 21–7) + Tests (7)

### Phase 3 — Listen, Checklisten, Offline
- [x] Einkaufsliste (gemeinsame Hauptliste), Kategorien, Abhaken (optimistisch) + Belohnung — nach Mockup 3
- [x] Kategorie-Heuristik + Tests (6)
- [ ] Terminbezogene Listen (Items aus Hauptliste in Einkaufstermin ziehen)
- [ ] Vorbereitungs-Checklisten editierbar am Termin (+ KI-Vorschläge je Kategorie in Phase 4)
- [ ] Offline-Queue (Abhaken offline persistent + später sync) — aktuell optimistisch/best-effort

### Phase 4 — KI
- [x] Prompt-Verzeichnis `/prompts` (versioniert) — schnellerfassung.v1.md
- [x] Schnellerfassung (NL → Terminvorschlag, Vorschau, Übernehmen/Verwerfen) + Normalisierung + Tests (4)
- [x] Anthropic-Client (serverseitig, Modell per Env, strukturierte Ausgabe, kein Thinking/low effort)
- [x] ai_feedback bei jeder Aktion
- [x] Übernehmen legt Termin real in iCloud an (ICS-Builder + createEvent)
- [ ] Kontextaufbau (Woche + learned_patterns + offene Anfragen + Kategorien)
- [ ] Wochenplanung (Sonntag), Fairness-Blick (deskriptiv)
- [ ] learned_patterns (lesbar/editierbar im UI)

### Phase 5 — Ideen & Urlaub
- [ ] Ideen-Board (Foto-Cards nach Mockup), Bewertung
- [ ] KI-Konkretisierung (Zeitfenster, „Passt gut"), Idee → Termin

---

## Log (neueste oben)
- _(Start)_ Loop eingerichtet, Nacht-Plan angelegt.
- Iteration 1: Test-Infra, Envelope-Crypto (+6 Tests), Auth.js Magic-Link + Allowlist (+4 Tests), Auth-Migration. Landing/style bleiben oeffentlich, App-Routen gated.
- Iteration 2: CalDAV-Interface + tsdav-Client, iCal-Parsing/Expansion (RRULE/EXDATE/RECURRENCE-ID, +8 Tests), Sync-Diff (+7 Tests). 25 Tests gruen, tsc sauber.
- Iteration 3: Wochenansicht + Termin-Detail (Mockup-treu, Screenshots geprueft), Repository, Format/Kategorien/View-Model (+5 Tests), Tab-Bar, oeffentliche Vorschau-Routen. 30 Tests gruen.
- Iteration 4: Sync-Engine an DB (Pull/upsert/delete, Konfliktprotokoll, Sync-Status), Account-Verbindung (Discovery, verschluesselt), interner Sync-Endpunkt + Worker-Trigger, Einstellungen-Screen (verbinden/toggles/sync). 30 Tests gruen, Build gruen.
- Iteration 5: Phase 2 Anfragen — Nudge-/Eskalationslogik (+7 Tests), Requests-Backend (Partner-Aufloesung, erstellen/beantworten), Braucht-deine-Antwort-Hero (Screenshot geprueft), Anfragen-Seite, Tab-Platzhalter. 37 Tests gruen.
- Iteration 6: Web Push (VAPID-Versand, Subscribe-Route, SW-Push/Click, Aktivieren-Button), Ruhezeiten (+7 Tests), taeglicher Nudge-Runner (Push+E-Mail-Eskalation) + interner Endpunkt + Worker-Job. 44 Tests gruen.
- Iteration 7: Baby-Betreuung (care_assignments) am Termin — Ich-mache-es / Auto-Anfrage bei offen, Wer-ist-beim-Baby-Karte (Screenshot geprueft). Phase 2 abgeschlossen. 44 Tests gruen.
- Iteration 8: Phase 3 Einkaufsliste (gemeinsame Hauptliste, Kategorien, optimistisches Abhaken + Belohnung, Hinzufuegen) nach Mockup 3 (Screenshot geprueft), Kategorie-Heuristik (+6 Tests). 50 Tests gruen.
- Iteration 9: Phase 4 KI-Schnellerfassung — versioniertes Prompt, Anthropic-Client (opus-5 default, konfigurierbar), strukturierte Ausgabe + Normalisierung (+4 Tests), Vorschau-UI (Uebernehmen/Verwerfen), ai_feedback, Erfassen-Zugang in der Woche. 54 Tests gruen.
- Iteration 10: App->iCloud-Schreibweg — ICS-Builder (+4 Round-Trip-Tests gegen den Parser), createEvent (PUT + lokale Spiegelung + event_details + Auto-Betreuungsanfrage), Schnellerfassung-Uebernehmen legt real an. Abnahmekriterium 2 abgedeckt. 58 Tests gruen.
