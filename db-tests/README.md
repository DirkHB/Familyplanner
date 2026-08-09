# Prüfungen gegen echtes Postgres

Was hier liegt, lässt sich mit Attrappen nicht ehrlich prüfen: doppelte
Anfragen, das richtige Vorkommen einer Serie, zwei Menschen, die gleichzeitig
auf denselben Knopf tippen. Eine nachgebaute Datenbank hätte genau die Fehler
nicht gezeigt, um die es geht.

```
createdb probe
DATABASE_URL='postgresql://…/probe' npx prisma migrate deploy
DATABASE_URL='postgresql://…/probe' ALLOWED_EMAILS='a@x.de,b@x.de' npm run test:db
```

**Nur gegen eine Wegwerf-Datenbank.** Die Prüfungen leeren Tabellen.

Zwei Attrappen liegen unter `stubs/`: `server-only` und `next/cache` gibt es
nur im laufenden Next-Server. Der Cache-Ersatz gibt jede Funktion unverändert
zurück — die Prüfungen sollen die Datenbank sehen, nicht einen Zwischenspeicher.
