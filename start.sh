#!/bin/sh
# App-Start: erst Migrationen einspielen, dann Server starten.
# Liegt im Image, damit kein CMD-Override mit "&&" noetig ist (Sliplane
# fuehrt Overrides nicht ueber eine Shell aus — "&&" kaeme sonst als
# Argument bei Prisma an und server.js wuerde nie starten).
#
# Bewusst KEIN "set -e": Faellt die Migration aus (Neon-Kaltstart, kurzer
# Netzwerkhaenger, falsche DATABASE_URL), beendete sich der Container sofort
# und Sliplane meldete nur "Failed to deploy" — ohne lesbaren Grund.
# Jetzt: mehrfach probieren, und im Zweifel trotzdem starten, damit die
# Ursache in den Laufzeit-Logs sichtbar bleibt.
set -u

PRISMA="node_modules/prisma/build/index.js"
SCHEMA="./prisma/schema.prisma"

echo "[start] prisma migrate deploy"

attempt=1
delay=2
migrated=0
while [ "$attempt" -le 5 ]; do
  if node "$PRISMA" migrate deploy --schema "$SCHEMA"; then
    migrated=1
    break
  fi
  if [ "$attempt" -eq 5 ]; then
    echo "[start] Migration fehlgeschlagen (Versuch 5 von 5)"
    break
  fi
  echo "[start] Migration fehlgeschlagen (Versuch $attempt von 5) — neuer Versuch in ${delay}s"
  sleep "$delay"
  attempt=$((attempt + 1))
  # Bei 8s deckeln: insgesamt hoechstens ~22s Wartezeit, damit der
  # Healthcheck von Sliplane nicht in der Startphase schon zuschlaegt.
  [ "$delay" -lt 8 ] && delay=$((delay * 2))
done

if [ "$migrated" -ne 1 ]; then
  echo "[start] ACHTUNG: Migration nach 5 Versuchen nicht durchgelaufen."
  echo "[start] Haeufigste Ursachen: DATABASE_URL fehlt/veraltet (z. B. nach"
  echo "[start] Passwort-Reset in Neon) oder die Datenbank ist nicht erreichbar."
  echo "[start] Der Server startet trotzdem — so bleibt der Fehler oben lesbar,"
  echo "[start] statt dass der Deploy kommentarlos abbricht."
fi

echo "[start] node server.js"
exec node server.js
