# Trägt der Google-Weg?

Eine halbe Stunde Handarbeit, danach wissen wir, ob die App in einen
Google-Kalender schreiben kann. Erst danach lohnt der Umbau.

Alles hier passiert in **deinem eigenen** Kalender, nicht in Johannas. Wenn es
bei dir läuft, läuft es bei ihr auch — und wenn nicht, hat niemand sonst etwas
davon gemerkt.

## Warum überhaupt ein Test

Der Weg heißt **Service Account**: ein technischer Google-Account mit eigener
Adresse. Du gibst ihm deinen Kalender frei, so wie du ihn einem Menschen
freigeben würdest, und ab dann darf unser Server dort schreiben. Kein
Zustimmungsbildschirm, keine Google-Prüfung, keine ablaufenden Tokens.

Zwei Dinge daran sind ungeprüft, und beide entscheiden über den Aufwand:

1. **Greift die Freigabe an einen Service Account überhaupt?** Bei privaten
   Google-Konten ist das der Schritt, an dem die Anleitungen im Netz dünn
   werden.
2. **Wie schnell zieht der .ics-Feed nach?** Wir wollen weiter über das
   Abonnement lesen und nur schreiben über die API. Hängt der Feed Stunden
   hinterher, wäre ein selbst angelegter Termin in der App lange unsichtbar —
   dann muss auch das Lesen über die API laufen, und der Umbau wird größer.

## 1. Google-Projekt und Schlüssel

1. [console.cloud.google.com](https://console.cloud.google.com) → neues Projekt
2. **APIs & Services → Library** → „Google Calendar API" → **Enable**
   (ohne das scheitert schon die Anmeldung)
3. **IAM & Admin → Service Accounts → Create Service Account** → Name vergeben,
   Rollen überspringen (die betreffen Google Cloud, nicht den Kalender)
4. Auf den Account klicken → **Keys → Add Key → Create new key → JSON** →
   herunterladen

Die heruntergeladene Datei ist der Schlüssel. Sie gehört **nicht** ins
Repository — für den Test bleibt sie in deinem Download-Ordner, für den Betrieb
später in die Sliplane-Umgebungsvariablen.

## 2. Kalender freigeben

Das ist der Schritt, an dem es hängt.

1. Google Kalender im Browser, beim gewünschten Kalender **Einstellungen und
   Freigabe**
2. Unter **Für bestimmte Personen freigeben** die `client_email` aus der
   JSON-Datei eintragen — sie sieht aus wie
   `irgendwas@dein-projekt.iam.gserviceaccount.com`
3. Berechtigung: **Änderungen an Terminen vornehmen**
   („Alle Termindetails sehen" reicht nicht — damit kann man nur lesen)
4. Weiter unten auf derselben Seite steht die **Kalender-ID**. Beim
   Hauptkalender ist das deine eigene Adresse.

Wenn du auch den Feed prüfen willst (empfohlen), hol dir auf derselben Seite
die **geheime Adresse im iCal-Format**.

## 3. Laufen lassen

```bash
GOOGLE_SA_JSON=~/Downloads/dein-projekt-abc123.json \
GOOGLE_CALENDAR_ID=dirkbrederecke@gmail.com \
GOOGLE_ICS_URL='https://calendar.google.com/calendar/ical/…/basic.ics' \
  node scripts/google-test.mjs
```

Das Skript meldet sich an, liest den Kalender, legt einen Testtermin drei
Wochen voraus an, benennt ihn um, wartet bis zu drei Minuten auf den Feed und
löscht ihn wieder — auch dann, wenn unterwegs etwas schiefgeht. Es braucht
keine zusätzlichen Pakete.

`GOOGLE_ICS_URL` kannst du weglassen, dann entfällt die Feed-Frage.
Zieht der Feed langsamer nach als drei Minuten, gib mehr Geduld:
`GOOGLE_FEED_GEDULD_S=900`.

## 4. Was am Ende dasteht

Das Skript sagt es dir im Klartext. Die vier möglichen Ausgänge:

| Ausgang | Was er bedeutet |
| --- | --- |
| Anmeldung scheitert | Calendar API im Projekt nicht eingeschaltet, oder E-Mail und Schlüssel aus verschiedenen Dateien |
| Kalender bleibt zu (404) | Die Freigabe ist nicht angekommen — Schritt 2 noch einmal |
| Lesen ja, Schreiben nein (403) | Berechtigung steht auf „Alle Termindetails sehen" statt „Änderungen an Terminen vornehmen" |
| Alles geht, Feed zieht nach | Der geplante Zuschnitt trägt: schreiben über die API, lesen weiter über das Abonnement |

Ein Sonderfall: Alles geht, **aber der Feed zieht nicht nach**. Dann trägt der
Weg trotzdem, nur muss auch das Lesen über die API gehen. Das ist die Sorte
Erkenntnis, für die dieser Test da ist — sie jetzt zu haben ist billiger, als
sie nach dem Umbau zu machen.

Schick mir einfach die Ausgabe, dann bauen wir auf dem auf, was tatsächlich
herauskommt.

## Was dabei nicht geht

Zwei Grenzen, die bleiben, egal wie der Test ausgeht:

- **Gäste einladen.** Ein Service Account darf ohne Domain-Wide Delegation
  keine Teilnehmer setzen, und die gibt es nur mit Google Workspace. Für uns
  egal — wir laden niemanden ein, wir schreiben Termine.
- **Als Organisator steht der Service Account dran**, nicht die Person.
  Kosmetisch.

Und eine Abwägung, die keine technische ist: „Änderungen an Terminen
vornehmen" heißt, dass unser Server in Johannas Kalender alles anlegen, ändern
und löschen darf. Das Abonnement war Lesen; das hier ist ein Schlüssel. Das
sollte sie wissen, bevor sie ihn übergibt.
