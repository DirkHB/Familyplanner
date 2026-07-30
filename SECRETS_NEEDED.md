# Secrets & Setup für morgen (Constanze und Dirk)

Der Code ist so gebaut, dass diese Werte **nur noch eingesetzt** werden müssen — lokal in `.env`
und in Produktion als Environment-Variablen der **beiden** Sliplane-Services (app + worker).
Nichts davon steht im Code. Reihenfolge = Priorität.

> Ich fülle diese Liste über Nacht mit genauen Hinweisen, sobald der jeweilige Code steht.

## 1. Datenbank (jetzt nötig, sobald wir Prod nutzen)
- [ ] **`DATABASE_URL`** — Sliplane managed Postgres anlegen (DEPLOY.md Abschnitt 1), interne URL
      bei **app** und **worker** eintragen. App-Start-Command auf
      `node_modules/.bin/prisma migrate deploy && node server.js` setzen (DEPLOY.md Abschnitt 5).

## 2. Auth (Login für euch beide)
- [ ] **`AUTH_SECRET`** — `openssl rand -base64 32`
- [ ] **`AUTH_URL`** — `https://planyourweek.app`
- [ ] **`ALLOWED_EMAILS`** — bereits `constanze? , dirkbrederecke@gmail.com` … (im Code default gesetzt:
      `dirkbrederecke@gmail.com,constanzehiller@hotmail.com`) — nur bestätigen.
- [ ] **`RESEND_API_KEY`** — Resend-Konto, API-Key. Absender-Domain `planyourweek.app` in Resend
      verifizieren (DNS-Records bei united-domains). **`EMAIL_FROM`** entsprechend setzen.

## 3. Verschlüsselung der iCloud-Zugänge
- [ ] **`ENCRYPTION_KEY`** — `openssl rand -base64 32` (32 Byte). Bei **app** und **worker** gleich.

## 4. iCloud-Kalender (CalDAV) — pro Person
- [ ] **App-spezifisches Passwort** für Constanze und für Dirk erzeugen:
      appleid.apple.com → Anmelden → „App-spezifische Passwörter" → neu erstellen.
      Diese trägst du **nicht** in .env ein, sondern **in der App** unter Einstellungen
      (sie werden verschlüsselt in der DB gespeichert).

## 4b. Worker → App Sync-Trigger
- [ ] **`WORKER_SECRET`** — `openssl rand -base64 32`. Bei **app** UND **worker** identisch setzen.
      (Der Worker ruft damit alle 5 Min den internen Sync-Endpunkt der App auf.)
- [ ] Optional **`APP_INTERNAL_URL`** — nur nötig, falls der Worker die App nicht über `AUTH_URL`
      erreicht (Default: `AUTH_URL`, sonst `https://planyourweek.app`).

## 5. Web Push (Benachrichtigungen)
- [ ] **`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`** — `npx web-push generate-vapid-keys` (nur **app** nötig)
- [ ] **`VAPID_SUBJECT`** — `mailto:dirkbrederecke@gmail.com`
- Der Client holt den öffentlichen Key zur **Laufzeit** über `/api/push/vapid-key` — kein `NEXT_PUBLIC` mehr nötig.
- Hinweis: Push funktioniert auf iOS **nur in der installierten PWA**. In der App unter
  Einstellungen → „Benachrichtigungen aktivieren" pro Gerät einmal erlauben.

## 6. KI
- [ ] **`ANTHROPIC_API_KEY`** — console.anthropic.com → API Keys.
- [ ] Optional **`ANTHROPIC_MODEL`** — Default ist jetzt `claude-sonnet-5` (bewusst gewählt, reicht aus).
      Für mehr Qualität `claude-opus-5`, für weniger Kosten `claude-haiku-4-5`.
      (Alle KI-Aufrufe nutzen geringe Effort-Stufe + kein Thinking.)

---
Details/Genauigkeit ergänze ich pro Feature über Nacht.
