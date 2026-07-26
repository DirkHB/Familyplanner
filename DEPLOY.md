# DEPLOY.md — Familienplaner auf Sliplane

Ziel: **ein Server, zwei Services** (App + Worker), **eine managed Postgres**, **eine Subdomain**.
Klein, EU, kein Redis, kein Kubernetes. Jeder Schritt ist markiert:
**[DU]** = im Sliplane-Dashboard · **[CODE]** = liegt schon im Repo.

> Symbole: 🟢 einmalig beim Aufsetzen · 🔁 bei jedem Deploy automatisch.

---

## 0. Überblick — was wohin gehört

```
GitHub-Repo (dieses)  ──push──▶  Sliplane baut automatisch aus dem Dockerfile
                                   │
                     ┌─────────────┴──────────────┐
              Service "app"                 Service "worker"
              CMD: node server.js           CMD: node worker/index.mjs
              Port 3000, Domain             kein Port, keine Domain
                     └─────────────┬──────────────┘
                          Managed Postgres (intern)
```

Beide Services laufen auf **demselben Server** (kostet nichts extra) und deployen aus
**demselben Repo/Image**, nur mit unterschiedlichem Start-Command.

---

## 1. 🟢 Server & Datenbank anlegen  **[DU]**

1. Sliplane → dein **Team** → **Projekt** anlegen (z. B. „Familienplaner").
2. **Server** anlegen: kleinste sinnvolle Größe (Nano/Small reicht für zwei Nutzer), Region **EU**.
3. **Managed Database** anlegen: **Postgres**.
   - Zugriff **nur internes Netzwerk**, nicht öffentlich exponieren.
   - Backups (täglich) sind bei der managed DB dabei — nichts weiter zu tun.
   - Kopiere die **interne Connection-URL** (Form `postgresql://…@…:5432/…`). Die brauchst du gleich als `DATABASE_URL`.

---

## 2. 🟢 GitHub verbinden & App-Service erstellen  **[DU]**

1. Service **„app"** → Quelle **GitHub** → dieses Repo, Branch `main` (oder dein Release-Branch).
2. Build: **Dockerfile** (liegt im Repo-Root — Sliplane nutzt es automatisch, kein Railpack).
3. **Port 3000** freigeben.
4. **Start-Command** leer lassen → nutzt den Docker-`CMD` (`node server.js`). **[CODE]**
5. Environment-Variablen setzen (siehe Abschnitt 4).

---

## 3. 🟢 Worker-Service erstellen  **[DU]**

1. Auf **demselben Server**: zweiten Service **„worker"** → **gleiches Repo, gleiches Dockerfile**.
2. **Kein Port**, **keine Domain**.
3. **Start-Command überschreiben** mit:
   ```
   node worker/index.mjs
   ```
4. **Dieselben** Environment-Variablen wie die App (mindestens `DATABASE_URL`, `TZ`, später
   `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `VAPID_*`, `ENCRYPTION_KEY`).

> Warum getrennt: Ein hängender CalDAV-Sync oder Worker-Crash darf die App nie mitreißen.

---

## 4. 🟢 Environment-Variablen  **[DU]** — pro Service eintragen

| Variable | Wert / Herkunft | App | Worker | Erklärung |
|----------|-----------------|:---:|:------:|-----------|
| `DATABASE_URL` | interne Postgres-URL aus Schritt 1 | ✅ | ✅ | DB-Verbindung, nur internes Netz |
| `TZ` | `Europe/Berlin` | ✅ | ✅ | Cron-Zeiten & Anzeige |
| `AUTH_SECRET` | `openssl rand -base64 32` | ✅ | — | Session-Signatur (Auth.js) |
| `AUTH_URL` | `https://plan.deinedomain.de` | ✅ | — | öffentliche App-URL |
| `ALLOWED_EMAILS` | `dirkbrederecke@gmail.com,c.brederecke@gmail.com` | ✅ | — | Login-Allowlist (genau ihr beide) |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` | ✅ | ✅ | verschlüsselt CalDAV-Zugänge at rest |
| `ANTHROPIC_API_KEY` | Anthropic Console | ✅ | ✅ | KI, nur serverseitig (ab Phase 4) |
| `RESEND_API_KEY` | Resend | ✅ | ✅ | Magic-Link + Eskalations-Mails |
| `EMAIL_FROM` | `Familienplaner <plan@deinedomain.de>` | ✅ | ✅ | Absender |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` | ✅ | ✅ | Web Push (ab Phase 2) |
| `VAPID_SUBJECT` | `mailto:dirkbrederecke@gmail.com` | ✅ | ✅ | Push-Kontakt |

> Für Phase 0 reichen **`DATABASE_URL`** und **`TZ`**. Den Rest füllst du, wenn die jeweilige Phase kommt.
> Vorlage mit Erklärungen: `.env.example` im Repo. **Niemals echte Werte committen.**

---

## 5. 🔁 Datenbank-Migration

Die Migrationen liegen versioniert unter `prisma/migrations/`. **[CODE]**

**Empfohlener Weg (einmal pro Deploy, sicher):** in den **App-Service** als Start-Command setzen:
```
node_modules/.bin/prisma migrate deploy && node server.js
```
Das spielt neue Migrationen ein und startet dann die App. Der Worker braucht das nicht.

**Alternativ manuell** (z. B. beim ersten Mal), über die Service-Konsole:
```
node_modules/.bin/prisma migrate deploy
```

> `migrate deploy` ist idempotent: bereits angewandte Migrationen werden übersprungen.

---

## 6. 🟢 Domain & DNS  **[DU]**

1. Service **„app"** → **Custom Domain** → `plan.deinedomain.de`.
2. Bei deinem DNS-Anbieter einen **CNAME** `plan` auf den von Sliplane angezeigten Zielhost setzen
   (Sliplane zeigt den genauen Wert an).
3. HTTPS/Zertifikat macht Sliplane automatisch — kurz warten, bis „aktiv".
4. `AUTH_URL` auf `https://plan.deinedomain.de` setzen (Abschnitt 4).

---

## 7. 🔁 Deploy auslösen

Jeder Push auf den verbundenen Branch baut und deployt automatisch — **App und Worker**.
Erststart: erst **app** (mit Migration), dann **worker**.

**Abnahme Phase 0:**
- `https://plan.deinedomain.de/` lädt in <2 s.
- `https://plan.deinedomain.de/style` zeigt Farben, Typo, Komponenten, Font-Switcher.
- Worker-Logs zeigen `"job":"boot"` und alle 5 Min `"job":"calendar-sync"`.

---

## 8. Logs lesen  **[DU]**

- Sliplane → Service → **Logs** (Live-Stream).
- App-Logs: HTTP-Requests, Fehler. Worker-Logs: strukturiertes JSON pro Cron-Tick.
- Sync-Status gibt es ab Phase 1 zusätzlich im **Settings-Screen** der App (letzter Lauf, letzter Fehler,
  Button „Jetzt synchronisieren").
- **Sliplane MCP (optional, empfohlen):** lokal `claude mcp add sliplane https://mcp.sliplane.io -t http -H "Authorization: Bearer <API_KEY>"` — dann liest Claude Code Deploys/Logs direkt.

---

## 9. Backup zurückspielen  **[DU]**

- Managed Postgres macht **tägliche Backups**. Wiederherstellen im DB-Menü über **Restore**
  (Zeitpunkt wählen). Achtung: überschreibt den aktuellen Stand.
- Zusätzliche Sicherheit: unsere App-Daten hängen an der stabilen iCalendar-UID — ein DB-Restore
  verliert nie den iCloud-Kalender selbst, nur ggf. jüngste Zusatzdaten.

---

## 10. Wenn ein Deploy fehlschlägt

1. **Build-Fehler** → Sliplane **Build-Logs** lesen. Häufig: fehlende Env-Var beim Build.
   (Unser Build braucht keine echte DB — `DATABASE_URL` wird beim Build nur als Dummy gelesen.)
2. **Start-Crash der App** → Logs. Häufig: `DATABASE_URL` falsch/leer, oder Migration schlug fehl.
3. **Migration schlägt fehl** → Konsole: `node_modules/.bin/prisma migrate status` zeigt den Stand.
4. **Rollback** → Sliplane deployt pro Commit; im Service-Verlauf auf einen früheren, grünen Build zurück.
5. **Worker läuft, App nicht (oder umgekehrt)** → das ist gewollt getrennt; den betroffenen Service
   einzeln neu deployen.

---

## 11. Was NICHT nötig ist (bewusst weggelassen)

Kein Redis, kein Message-Broker, kein zweiter Server, kein Load-Balancer, kein Docker-Compose
(Sliplane unterstützt es nur teilweise — wir bauen nicht darauf). Zwei Nutzer, zwei Services. Fertig.
