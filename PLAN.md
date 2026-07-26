# PLAN.md — Familienplaner

> Eine App für **genau zwei Menschen**: unseren Alltag mit Neugeborenem koordinieren.
> Kernnutzen: Apple-Kalender bidirektional spiegeln, hinter jedem Termin die Vorbereitung
> und Absprache bündeln, und per KI beim Planen der Woche helfen.

Status: **Warte auf „go"** vor dem ersten Produktcode. Dieses Dokument ist die Grundlage.

---

## 0. Leitplanken (nicht verhandelbar)

- **Zwei Nutzer, keine Skalierung.** Kein Signup, keine Rollen, keine Mandanten. Allowlist auf zwei E-Mails.
- **Einhändig, nachts, mit Baby auf dem Arm.** Wichtigste Aktion pro Screen ohne Scrollen, großes Ziel, unteres Bildschirmdrittel.
- **Zuverlässigkeit vor Features.** Nie stillschweigend Daten verlieren. Sync-Fehler sichtbar, nicht App-tötend.
- **EU-Hosting, DSGVO.** Keine Tracker, keine Analytics-Pixel, selbst gehostete Fonts, keine Google-Fonts-CDN.
- **Keine Geheimnisse im Code.** Alles über `.env` lokal und Sliplane-Env in Produktion.

---

## 1. Architektur

### 1.1 Überblick

```
┌────────────────────────────────────────────────────────────┐
│  Sliplane Server (kleinste sinnvolle Größe, EU)            │
│                                                            │
│  Service „app"            Service „worker"                 │
│  Next.js (standalone)     node-cron Scheduler             │
│  - UI (PWA)               - Kalender-Sync alle 5 min       │
│  - API Routes             - Täglicher Nudge (09:00)        │
│  - Auth.js (Magic Link)   - Wochenreview (So abends)       │
│  - Web Push               - Eskalations-Mails              │
│         │                        │                        │
│         └──────────┬─────────────┘                        │
│                    ▼                                       │
│         Managed Postgres (intern, nicht öffentlich)       │
│         Object Storage (S3-kompatibel, Foto-Uploads)      │
└────────────────────────────────────────────────────────────┘

Extern: iCloud CalDAV · Anthropic API · Resend (E-Mail) · Web Push (VAPID)
```

**Genau zwei Services, ein Server, ein Repo.** App und Worker teilen sich Code
(gleiches Prisma-Schema, gleiche `lib/`-Module), unterscheiden sich nur im Start-Command.
Ein Absturz des Workers reißt die App nicht mit.

### 1.2 Warum diese Aufteilung

- **App-Service** bedient Nutzer-Requests, muss schnell und immer erreichbar sein.
- **Worker-Service** macht die zeitgesteuerte, potenziell langsame Arbeit (CalDAV, KI-Batches).
  Getrennt, damit ein hängender Sync die UI nie blockiert.
- **Kein Redis, kein Kubernetes, keine Microservices.** Postgres reicht für Queue-artige
  Bedürfnisse (wir haben faktisch keine). node-cron reicht als Scheduler.

### 1.3 Stack

| Ebene        | Wahl                                    | Begründung (kurz)                          |
|--------------|-----------------------------------------|--------------------------------------------|
| Framework    | Next.js App Router, TypeScript          | Vorgabe; PWA + API in einem                |
| DB           | Postgres (Sliplane managed) + Prisma    | Vorgabe; Prisma = typsichere Migrationen   |
| Auth         | Auth.js, Magic Link, 2er-Allowlist      | Vorgabe; lange Sessions                    |
| Styling      | Tailwind + OKLCH-Tokens                 | Vorgabe; Design-System aus Abschnitt 7     |
| Motion       | motion.dev (React)                      | Vorgabe                                     |
| CalDAV       | tsdav + ical.js + rrule                 | Vorgabe; bewährt, kein Eigenbau-Parsing    |
| KI           | Anthropic API, serverseitig             | Vorgabe; Key nie im Client                 |
| E-Mail       | Resend                                  | Vorgabe; Magic Link + Eskalation           |
| Push         | Web Push (VAPID), installierte PWA      | iOS erlaubt Push nur für installierte PWA  |
| Scheduler    | node-cron im Worker                     | Sliplane hat keinen Cron                    |
| Verschlüss.  | Envelope Encryption (AES-256-GCM)       | CalDAV-Creds at rest, Key als Env          |

---

## 2. Datenmodell

Prisma-Schema. UTC überall gespeichert, Europe/Berlin angezeigt. Unsere Zusatzdaten hängen
an der **stabilen iCalendar-UID**, nicht an DB-ID oder href.

```
users            id, name, email, notification_prefs (jsonb), created_at
push_subscriptions  id, user_id, endpoint, keys (jsonb), created_at
calendar_accounts   id, user_id, provider, credentials_encrypted, principal_url, created_at
calendars        id, account_id, name, url, ctag, sync_token, is_synced, color
events           id, calendar_id, uid, href, etag, title, start, end, all_day,
                 location, rrule, recurrence_id, raw_ics, status, last_synced_at
event_details    event_uid (PK), category, notes, prep_checklist (jsonb), created_by, updated_at
care_assignments id, event_uid, occurrence_date, responsible_user_id, from_ts, to_ts,
                 status (offen|zugesagt|geklaert), note
shopping_lists   id, kind (haupt|termin), event_uid (nullable), name
shopping_items   id, list_id, event_uid (nullable), text, quantity, category,
                 added_by, checked_by, checked_at
requests         id, from_user, to_user, event_uid (nullable), question,
                 type (yes_no|choice|free_text|date), options (jsonb), answer,
                 status (open|answered|declined), due_date, last_nudge_at, created_at
ideas            id, type (urlaub|ausflug|restaurant|geschenk), title, description,
                 link, images (jsonb), votes (jsonb), target_period, status
learned_patterns id, label, pattern (jsonb), source, is_active, updated_at   -- editierbar im UI
ai_feedback      id, suggestion_id, suggestion_payload (jsonb), user_id,
                 action (accepted|rejected|edited), edited_result (jsonb), created_at
activity_log     id, entity_type, entity_id, action, actor, detail (jsonb), created_at
```

**Konfliktstrategie (Kern):**
- iCloud = Wahrheit für Kalenderfelder (Titel, Zeit, Ort, Teilnehmer, Wiederholung).
- App = alleinige Wahrheit für Zusatzdaten (Checkliste, Betreuung, Anfragen, Notizen).
- Echte Kollision → last write wins **+ Eintrag in `activity_log` + Info im UI**. Nie stumm.

---

## 3. Kalender-Sync (kritischstes Modul, zuerst und sauber)

Gekapselt hinter einem Interface `CalDavClient`, damit lokal gegen `.ics`-Fixtures testbar
ohne echten iCloud-Zugang.

- **Discovery:** Principal → Kalenderliste → Nutzer wählt zu syncende Kalender in Settings.
- **Pull:** `sync-collection` (RFC 6578) zuerst, Fallback CTag-Vergleich pro Kalender +
  ETag-Vergleich pro Event. Speichere href, etag, uid, ctag, rohe `.ics`.
- **Push:** `PUT` mit `If-Match` auf bekanntes ETag. Bei `412` neu laden, mergen, erneut.
- **Frequenz:** Cron alle 5 min + sofort bei App-Fokus + nach jeder Schreiboperation.
- **Wiederholungen:** RRULE, EXDATE, RECURRENCE-ID (Einzelausnahmen). Beim Bearbeiten immer
  fragen: nur dieser Termin oder ganze Serie.
- **Zeitzonen:** UTC speichern, Europe/Berlin anzeigen. Ganztags = reine Datumswerte.

**Risiko & Fallback:** Wenn iCloud-CalDAV zu unzuverlässig wird (bekannt: sync-token-Zicken,
Rate Limits), melde ich das **früh**. Alternativen: native iOS-App mit EventKit oder Umzug
des Familienkalenders zu Google Calendar API. Beides ändert das Projekt deutlich — Entscheidung
bewusst, nicht durch die Hintertür.

---

## 4. KI-Assistenz

- Serverseitig, Anthropic API. **Alle Ausgaben sind Vorschläge, nie Auto-Schreibvorgänge.**
- Jeder Vorschlag: „Übernehmen / Anpassen / Verwerfen" → landet in `ai_feedback`.
- Prompts **versioniert in `/prompts`** im Repo, nicht inline verstreut.
- Kompakter Kontext pro Call: aktuelle Woche + `learned_patterns` + offene Anfragen + Kategorien.
- Gelernte Muster = lesbare, editierbare Zeilen in `learned_patterns` (kein Black-Box, kein Fine-Tuning).
- Kostenbewusst: bündeln, cachen, **kein Call pro Tastenanschlag**.

Funktionen: Schnellerfassung (NL→strukturierter Terminvorschlag), Wochenplanung (So-Ritual),
Fairness-Blick (deskriptiv, Zahlen ohne Urteil), Ideen-/Urlaubsboard.

---

## 5. Design-System (Abschnitt 7 des Briefings)

- **Farben** in OKLCH-Tokens (Startwerte aus dem Briefing): warmes Beige-Grund, Dunkelblau-Anker,
  Türkis als **einziger** Akzent (sparsam!), warmer Kontrapunkt nur für Feierliches, Signal nur für Überfälliges.
- **Keine** reinen Grautöne, kein reines Schwarz/Weiß, keine Verläufe außer kaum sichtbarem Schimmer.
  Dark Mode = tiefes Mitternachtsblau + sandfarbene Schrift.
- **Fonts** selbst gehostet, Tabellenziffern für Zahlen/Zeiten. Font-Switcher auf interner Vorschau-Seite.
  Favoriten-Paarung als Default: **Fraunces + Satoshi**.
- **Motion** (motion.dev): nur `transform`/`opacity`, ease-out fürs Eintretende, Spring für Finger-Gesten,
  Dauern 100–400 ms, `prefers-reduced-motion` überall. Häufige Aktionen (Abhaken) animieren minimal/gar nicht.
- **Anti-Slop:** kein Glassmorphism, keine Bento-Grids, keine Emoji-UI, keine Dashboard-Ästhetik.
  Pro Screen genau **eine** visuelle Hauptsache.
- **Skills:** Impeccable/Emil Kowalski/Taste sind in dieser Umgebung nicht installierbar
  → ich verankere ihre Kernregeln fest im System und auditiere jeden Screen manuell (audit/critique/polish
  als Checkliste). Wenn du sie lokal einrichtest, ziehe ich nach.
- **`/style`-Seite zuerst** (Phase 0): alle Tokens, Textgrößen, Komponenten, Motion-Bausteine.

---

## 6. Phasenplan

| Phase | Inhalt | „Fertig" heißt |
|-------|--------|----------------|
| **0** | Repo, Dockerfile (multi-stage, `output: standalone`), Worker-Setup, Prisma-Schema + Migrationen, DEPLOY.md, `/style`-Seite | Lokal lauffähig, deploy-fertig. Erster echter Deploy zusammen mit Phase 1. |
| **1** | CalDAV bidirektional (fixtures-first + Tests), Wochenansicht, Termin-Detail mit Notizen, Auth für uns beide, PWA installierbar | Abnahmekriterien Abschnitt 11 erfüllt |
| **2** | Baby-Betreuung, Anfragen + täglicher Nudge, Web Push, Ruhezeiten | Anfrage in <5 s beantwortbar, Nachtfenster hält |
| **3** | Einkaufslisten (haupt + terminbezogen), Vorbereitungs-Checklisten, Offline-Fähigkeit | Abhaken offline, synchronisiert später |
| **4** | KI: Schnellerfassung, Wochenplanung, gelernte Muster, Fairness-Blick | Vorschläge mit Übernehmen/Anpassen/Verwerfen, `ai_feedback` gefüllt |
| **5** | Ideen-/Urlaubsboard inkl. Umwandlung in Termine | Idee → echter Terminvorschlag |

**Nach jeder Phase:** lauffähiger Stand, kurzer Test, sauberer Commit. Tests verpflichtend für
Sync, Wiederholungsregeln, Erinnerungen.

---

## 7. Abnahmekriterien Phase 1

1. Termin in iPhone-Kalender angelegt → erscheint in <5 min in der App.
2. Termin in App geändert → korrekt im iPhone-Kalender, richtige Zeitzone, keine Dublette.
3. Serie mit einer verschobenen Ausnahme → korrekt dargestellt, nicht zerstört.
4. Sync-Fehler → sichtbar gemeldet, App bleibt nutzbar.
5. PWA auf iPhone installierbar, Start <2 s.

---

## 8. Offene Risiken

| Risiko | Wahrscheinlichkeit | Gegenmaßnahme |
|--------|--------------------|---------------|
| iCloud-CalDAV unzuverlässig (sync-token, Rate Limits) | Mittel | Fixtures-first, CTag/ETag-Fallback, frühe Echt-Tests in P1; Fallback-Optionen dokumentiert |
| iOS Web Push nur für installierte PWA | Sicher | Onboarding-Schritt „zum Homescreen hinzufügen", E-Mail-Fallback via Resend |
| Serien-Bearbeitung (RECURRENCE-ID) fehlerhaft | Mittel | Dediziertes Test-Set mit Fixtures, „nur dieser/ganze Serie"-Dialog |
| Design-Skills nicht installierbar | Sicher | Regeln fest verankert + manueller Audit |
| KI-Kosten | Niedrig | Bündeln, cachen, kein Call pro Tastendruck |

---

## 9. Offene Entscheidungen für dich (blockieren nicht, aber gut zu wissen)

1. **Domain**: Subdomain-Vorschlag `plan.<deinedomain>.de` — welche Domain?
2. **Sliplane MCP**: einrichten (ich lese Logs/Deploys selbst) oder manuell via DEPLOY.md?
3. **CalDAV-Zugänge**: fixtures-first (Default) oder willst du früh echte App-Passwörter geben?
4. **Font-Default**: Fraunces + Satoshi (mein Vorschlag) — okay als Start?

Sag **„go"**, dann starte ich mit Phase 0.
