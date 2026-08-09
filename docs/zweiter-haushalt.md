# Zweiter Haushalt aufsetzen (für Dirk)

Thomas und Yvonne bekommen eine **eigene Instanz**: eigene Datenbank, eigene
App, eigener Worker, eigene Adresse. Gemeinsam bleiben nur die Dinge, die auf
uns laufen — Anthropic-Schlüssel, Resend-Konto, Domain. Sie sehen unsere Daten
nicht und wir ihre nicht, weil es schlicht zwei getrennte Datenbanken sind.

Rechne mit **45 bis 60 Minuten**.

---

## Wie die Kalender zusammenspielen

Kein gemeinsamer Familienkalender in iCloud. **Jeder verbindet seinen eigenen**,
die App legt beide übereinander, und jeder legt einmal fest, in welchen seiner
Kalender neu Angelegtes geschrieben wird. Beim Anlegen steht über dem Knopf
„Kalender von …" — voreingestellt auf einen selbst, ein Tipp wechselt zur
anderen Person (für den Zahnarzttermin, den man für sie ausgemacht hat).

Damit bleibt jeder Termin an genau einem Ort, und niemand muss bei jedem
Eintrag entscheiden „privat oder Familie?".

**Ein Punkt bleibt offen:** Yvonnes Android-Kalender ist fast sicher ein
Google-Kalender, und den kann die App noch nicht anbinden — die
CalDAV-Adresse steht fest auf iCloud. Bis das gelöst ist, hat sie **kein
eigenes Schreibziel**, und die App fällt für sie auf Thomas' Kalender zurück.
Das ist genau der Fall, den wir vermeiden wollten; er ist nur noch der letzte
Ausweg statt die Regel.

Zwei Wege in der Zwischenzeit, beide in Ordnung:

1. **Yvonne legt sich eine Apple-ID an** (geht auf appleid.apple.com ohne
   Apple-Gerät) und verbindet deren Kalender. Dann hat sie ein eigenes
   Schreibziel. Sie sieht ihn nur über die App — was reicht, wenn sie ohnehin
   dort arbeitet.
2. **Sie trägt vorerst nichts selbst ein**, und Thomas legt Gemeinsames an.
   Weniger schön, aber nichts landet an einer falschen Stelle.

Sag Bescheid, wenn Thomas seinen Google-Kalender testweise per CalDAV
freigeben kann — dann probieren wir Weg drei.

## 1. Datenbank bei Neon

1. In Neon ein **neues Projekt** anlegen, Region **Frankfurt** (wie unseres).
2. Namen so wählen, dass du ihn später wiedererkennst.
3. Den **Connection String** kopieren. Er muss dieselbe Form haben wie unserer:
   `postgresql://BENUTZER:PASSWORT@HOST:5432/DATENBANK`
4. Weglegen — den brauchst du gleich als `DATABASE_URL`.

Die Datenbank bleibt leer. Die Tabellen legt der erste Start der App selbst an
(`start.sh` fährt `prisma migrate deploy`). Unsere Beispieldaten aus den alten
Migrationen kommen dort **nicht** an: Migration 0013 räumt sie auf jeder
Datenbank weg, in der sich noch nie jemand angemeldet hat.

## 2. Schlüssel erzeugen

Jede Instanz braucht eigene. Vier Befehle im Terminal:

```
openssl rand -base64 32     # → AUTH_SECRET
openssl rand -base64 32     # → ENCRYPTION_KEY
openssl rand -base64 32     # → WORKER_SECRET
npx web-push generate-vapid-keys   # → VAPID_PUBLIC_KEY und VAPID_PRIVATE_KEY
```

`ENCRYPTION_KEY` verschlüsselt Thomas' iCloud-Passwort. Wenn der verloren geht,
muss er den Kalender neu verbinden — also mit ablegen, wo du unsere Schlüssel
auch aufbewahrst. **Nirgendwo ins Repository.**

## 3. Adresse festlegen

Such dir eine Subdomain unserer Domain aus, zum Beispiel
`zwei.planyourweek.app`. Beim DNS-Anbieter einen **CNAME** auf den Sliplane-
Service zeigen lassen (die Zieladresse zeigt dir Sliplane an, sobald der
Service steht — also Schritt 4 zuerst, dann hierher zurück).

Die Adresse ist wichtiger, als sie aussieht: Sie steht in `AUTH_URL`, und die
Magic-Link-Mails zeigen dorthin. Später ändern heißt, dass alle offenen Links
tot sind.

## 4. Sliplane-Service „App"

Neuer Service aus demselben Repository wie unserer.

| Feld | Wert |
|---|---|
| Dockerfile Path | `Dockerfile` |
| Start Command / CMD-Override | **leer lassen** |
| Port | `3000` |
| Healthcheck | `/api/health` |

Die beiden Fallen, die uns schon Zeit gekostet haben:

- **Der CMD-Override muss leer bleiben.** `start.sh` macht Migration *und*
  Serverstart. Sliplane führt Overrides nicht über eine Shell aus — ein `&&`
  käme als Argument bei Prisma an.
- **„Dockerfile Path" muss wirklich `Dockerfile` enthalten**, sonst baut
  Sliplane mit Railpack am Dockerfile vorbei.
- **Ohne Healthcheck läuft der Service in eine Redeploy-Schleife.**

## 5. Sliplane-Service „Worker"

Zweiter Service, **dasselbe Image**, nur ein anderer Start:

| Feld | Wert |
|---|---|
| Dockerfile Path | `Dockerfile` |
| Start Command / CMD-Override | `node worker/index.mjs` |
| Port | `3000` |
| Healthcheck | `/api/health` |

Der Worker antwortet auf jedem Pfad mit `200` — der Healthcheck greift also
genauso wie bei der App. Er übernimmt: Kalender-Sync alle 5 Minuten, Briefings
morgens um 7, Erinnerungen, die Abend-Nachfrage bei offener Betreuung und den
Aufgaben-Vorschlag alle 15 Minuten.

## 6. Umgebungsvariablen

Bei **beiden** Services identisch eintragen.

### Neu für diese Instanz

| Variable | Wert |
|---|---|
| `DATABASE_URL` | der Neon-String aus Schritt 1 |
| `AUTH_SECRET` | erster `openssl`-Wert |
| `ENCRYPTION_KEY` | zweiter `openssl`-Wert |
| `WORKER_SECRET` | dritter `openssl`-Wert — bei App **und** Worker gleich |
| `AUTH_URL` | `https://zwei.planyourweek.app` (deine Adresse aus Schritt 3) |
| `ALLOWED_EMAILS` | `thomas@…,yvonne@…` |
| `VAPID_PUBLIC_KEY` | aus `web-push` |
| `VAPID_PRIVATE_KEY` | aus `web-push` |

### Von uns übernommen

| Variable | Wert |
|---|---|
| `RESEND_API_KEY` | unser Schlüssel |
| `EMAIL_FROM` | `Familienplaner <plan@planyourweek.app>` |
| `ANTHROPIC_API_KEY` | unser Schlüssel |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` empfohlen — siehe Kosten unten |
| `VAPID_SUBJECT` | `mailto:dirkbrederecke@gmail.com` (du bist der Betreiber) |
| `TZ` | `Europe/Berlin` |
| `APP_INTERNAL_URL` | leer lassen, außer Sliplane gibt dir eine interne Adresse |

**Zwei Dinge, die leicht übersehen werden:**

1. **Die Reihenfolge in `ALLOWED_EMAILS` entscheidet, wer Platz A ist.** Trag
   Thomas zuerst ein, wenn er Platz A sein soll. Später umsortieren verschiebt
   die Zuordnung nicht mehr (die Plätze bleiben in der Datenbank), aber beim
   ersten Mal zählt es.
2. **Nur diese zwei Adressen kommen rein.** Meine steht nicht in ihrer
   Allowlist — ich kann mich in ihrer Instanz also gar nicht anmelden, auch
   wenn ich wollte. Das ist Absicht und sollte so bleiben.

**Für unsere eigene Instanz:** Die Reihenfolge bestimmt jetzt auch, in welcher
Richtung Namen ausgeschrieben werden — auf der Anmeldeseite steht „Für Dirk und
Constanze", weil deine Adresse vorn steht. Wenn dir „Constanze und Dirk" lieber
ist, tausch die beiden in Sliplane. Das verschiebt nichts mehr: Unsere Plätze
stehen seit Migration 0014 in der Datenbank und hängen nicht länger an der
Umgebungsvariablen.

## 7. Erster Start prüfen

1. App-Service ausrollen, **Logs öffnen**. Du willst sehen:
   `[start] prisma migrate deploy` und danach `[start] node server.js`.
   Bricht die Migration ab, startet der Server trotzdem — der Grund steht
   dann oben im Log lesbar da (meist eine falsche `DATABASE_URL`).
2. `https://zwei.planyourweek.app/api/health` aufrufen → `{"ok":true,…}`.
3. Worker-Service ausrollen, Logs prüfen: die Cron-Jobs melden sich beim Start.
4. Die Anmeldeseite aufrufen. Melde dich **nicht** selbst an — deine Adresse
   ist nicht freigeschaltet, es käme nur eine Fehlermeldung.

## 8. Übergabe

Thomas bekommt von dir:

- die Adresse (`https://zwei.planyourweek.app`)
- die Bestätigung, welche zwei E-Mail-Adressen freigeschaltet sind
- die Anleitung `docs/anleitung-thomas.md`

Alles Weitere macht er selbst: Beim ersten Aufruf von `/woche` landet er
automatisch im Einrichtungs-Assistenten, weil noch nichts eingerichtet ist.

Sag ihm dabei die beiden Dinge, die in der Anleitung stehen, aber leicht
überlesen werden: dass beim Verbinden **alle** seine iCloud-Kalender
hereinkommen und er die überflüssigen abschalten muss, und dass Yvonne bis auf
Weiteres kein eigenes Schreibziel hat.

---

## Was du danach im Blick behältst

**Kosten.** Anthropic läuft über unseren Schlüssel, also auf unsere Rechnung.
Pro Haushalt und Tag sind das ein Briefing morgens, eins sonntags und die
Aufgaben-Vorschläge. Mit `claude-sonnet-5` bleibt das im Cent-Bereich; mit
`claude-opus-5` etwa das Fünffache. Falls es sich lohnt, kannst du in Anthropic
später einen zweiten API-Schlüssel anlegen und ihn nur für Thomas' Instanz
verwenden — dann siehst du in der Abrechnung, was auf wen entfällt.

**Updates.** Beide Instanzen ziehen aus demselben Repository. Wenn du bei uns
ausrollst, denk daran, dass Thomas' Services nicht automatisch mitkommen —
Sliplane muss dort separat neu bauen. Migrationen laufen beim Start von selbst.

**Was du sehen kannst und was nicht.** Du hast Zugriff auf die Neon-Datenbank
und die Sliplane-Logs, also technisch auf alles. Das solltest du Thomas einmal
klar sagen, bevor er anfängt, private Termine einzutragen — nicht als
Formalie, sondern damit er es weiß.
