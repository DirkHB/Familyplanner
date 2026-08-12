# Jemanden einladen (für Dirk)

Eine befreundete Familie bekommt **keine eigene Instanz** mehr. Sie bekommt
einen Link. Die App trennt die Haushalte selbst: Jede Zeile in der Datenbank
gehört einem Haushalt, und jede Abfrage läuft durch einen Riegel, der ihn
einsetzt. Zwei Familien in derselben Datenbank sehen voneinander nichts.

Rechne mit **zwei Minuten**.

Die alte Fassung dieser Anleitung beschrieb 45 bis 60 Minuten Handarbeit:
eigene Neon-Datenbank, eigene Schlüssel, eigene Subdomain, zwei Sliplane-
Services, Adressen in `ALLOWED_EMAILS`. Das ist ersatzlos weg. Wer es
nachlesen will, findet es in der Git-Geschichte.

---

## So geht es

1. In der App auf **Einstellungen → Wer wohnt hier → Einladungen**.
   (Die Zeile sieht nur, wer das Verwaltungsrecht hat — das bist du.)
2. Adresse eintragen, **Einladung schicken**.
3. Fertig. Du musst nichts weiter tun — nicht im Code, nicht in Sliplane,
   nicht in der Datenbank.

Die andere Seite bekommt eine Mail mit einem Link.

**Der Link steht auch bei dir auf dem Bildschirm** — direkt unter der
Bestätigung, mit einem Knopf zum Kopieren. Er ist genau derselbe, den die Mail
enthält. Du kannst ihn also per WhatsApp, iMessage oder wie auch immer
weitergeben, wenn dir das lieber ist oder wenn die Mail nicht ankommt. Der Link
ist der Zugang; die Mail ist nur der Bote.

Er steht dort **einmal**, direkt nach dem Verschicken. Danach nicht mehr: In
der Datenbank liegt nur sein Abdruck, wiederherstellen kann ihn niemand. Ist er
weg, lade dieselbe Adresse einfach noch einmal ein — das ersetzt die alte
Einladung und zeigt dir einen frischen Link.

Der Link

- funktioniert **einmal**,
- gilt **zwei Wochen**,
- und nur die Adresse, an die er ging, kann ihn einlösen. Auf welchem Weg er
  dorthin kommt, ist egal — als Mail oder von dir weitergereicht. Landet er bei
  jemand anderem, nützt er dem nichts: Wer ihn antippt, löst nur aus, dass eine
  Anmeldemail an die ursprüngliche Adresse geht.

Beim Einlösen entsteht ein **neuer Haushalt**. Die Person landet direkt im
Einrichtungs-Assistenten: Namen, Kalender verbinden, die zweite Person
einladen, Aufgaben, Listen. Die zweite Person lädt sie selbst ein — dafür
brauchst du nicht noch einmal gefragt zu werden.

Eine offene Einladung kannst du auf derselben Seite zurücknehmen, solange sie
niemand eingelöst hat. Dieselbe Adresse noch einmal einzuladen ersetzt die
alte Einladung; es liegen nie zwei gültige Links für einen Menschen herum.

**Wenn die Mail nicht ankommt:** Nimm den Link vom Bildschirm — damit ist
niemand aufgehalten. Zum Nachsehen, woran es lag, steht der Versand im
Resend-Dashboard unter „Emails", und was die App selbst nicht geschafft hat,
steht im Sliplane-Log des App-Dienstes als Zeile mit `"service":"einladung"`.

---

## Wie die Kalender zusammenspielen

Kein gemeinsamer Familienkalender in iCloud. **Jeder verbindet seinen eigenen**,
die App legt beide übereinander, und jeder legt einmal fest, in welchen seiner
Kalender neu Angelegtes geschrieben wird. Beim Anlegen steht über dem Knopf
„Kalender von …" — voreingestellt auf einen selbst, ein Tipp wechselt zur
anderen Person (für den Zahnarzttermin, den man für sie ausgemacht hat).

Damit bleibt jeder Termin an genau einem Ort, und niemand muss bei jedem
Eintrag entscheiden „privat oder Familie?".

**Johannas Android-Kalender** ist fast sicher ein Google-Kalender. Verbinden
kann die App ihn nicht: Google hat CalDAV mit Passwort im März 2025
abgeschaltet, seitdem geht nur noch OAuth — und das setzt ein geprüftes
Entwicklerkonto bei Google voraus, mit Warnbildschirm für jede Person, die
sich anmeldet.

**Verbinden geht trotzdem — in beide Richtungen.** Unter *Einstellungen →
Google-Kalender* führt die App durch drei Schritte in Googles Oberfläche.
Danach stehen Johannas Termine in der gemeinsamen Woche, zählen bei der
Betreuung mit, **und** sie hat ein eigenes Schreibziel: Was sie anlegt, und
ihre Betreuungsblöcke, landen in ihrem Kalender statt in Thomas'.

Der Weg dorthin, in Google Kalender am Rechner:

1. **Freigeben.** Einstellungen → links auf den eigenen Kalender → „Für
   bestimmte Personen oder Gruppen freigeben" → die Dienstadresse der App
   eintragen (sie steht im Formular zum Antippen bereit), Berechtigung
   **„Änderungen an Terminen vornehmen"**.
2. **Kalender-ID** holen — dieselbe Seite, unter „Kalender integrieren".
3. **Geheime Adresse im iCal-Format** holen — ebenfalls dort.

Beim Verbinden probiert die App beides wirklich aus, bevor sie etwas
speichert: Sie legt einen Termin an und löscht ihn sofort wieder, und sie holt
den Feed einmal. Anders lässt sich nicht feststellen, ob die Freigabe wirklich
zum Schreiben berechtigt.

Zwei Dinge dazu:

- **Mehr Handgriffe, als uns lieb ist.** Der bequeme Weg — „Mit Google
  verbinden", Konto wählen, zulassen — setzt eine von Google geprüfte App
  voraus. Die Prüfung ist Papierkram (Datenschutzerklärung, Domainnachweis,
  Demo-Video), kein Programmieren; ist sie durch, tritt sie an dieselbe
  Stelle und der Rest bleibt, wie er ist.
- **Die iCal-Adresse ist ein Geheimnis.** Wer sie hat, sieht den Kalender. Sie
  wird verschlüsselt gespeichert wie ein Passwort und nirgends wieder
  angezeigt.

Wer nur **lesen** will — der Vereinskalender, die Kita, ein fremder Kalender
ohne Schreibbedarf —, nimmt weiterhin *Einstellungen → Kalender abonnieren*.
Das braucht keine Freigabe, nur die iCal-Adresse, und geht dafür nur in eine
Richtung.

---

## Was du danach im Blick behältst

**Kosten.** Anthropic läuft über unseren Schlüssel, also auf unsere Rechnung.
Pro Haushalt und Tag sind das ein Briefing morgens, eins sonntags und die
Aufgaben-Vorschläge. Mit `claude-sonnet-5` bleibt das im Cent-Bereich; mit
`claude-opus-5` etwa das Fünffache. Bei sieben Haushalten also weiter
überschaubar — aber es ist jetzt unsere Rechnung für alle, nicht mehr eine pro
Instanz. Wenn das kippt, ist die Stellschraube `ANTHROPIC_MODEL`.

**Updates.** Es gibt nur noch eine Instanz. Wenn du ausrollst, sind alle
Haushalte gleichzeitig auf dem neuen Stand — das ist der angenehme Teil, und
zugleich der Grund, vor dem Ausrollen die Prüfkette laufen zu lassen.

**Was du sehen kannst und was nicht.** Du hast Zugriff auf die Datenbank und
die Sliplane-Logs, also technisch auf alles — auch auf die Termine der anderen
Haushalte. Der Riegel schützt die Familien voreinander, nicht vor dir. Das
solltest du jedem einmal klar sagen, bevor er anfängt, private Termine
einzutragen — nicht als Formalie, sondern damit er es weiß.

**Wer einlädt.** Das Verwaltungsrecht hängt an einer Spalte (`users.is_admin`)
und trägt genau eine Person: die älteste Nutzerzeile der Datenbank. Innerhalb
eines Haushalts braucht es das nicht — dort lädt jeder seine zweite Person
selbst ein.
