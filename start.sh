#!/bin/sh
# App-Start: erst Migrationen einspielen, dann Server starten.
# Liegt im Image, damit kein CMD-Override mit "&&" nötig ist (Sliplane
# führt Overrides nicht über eine Shell aus — "&&" käme sonst als
# Argument bei Prisma an und server.js würde nie starten).
set -e
echo "[start] prisma migrate deploy"
node node_modules/prisma/build/index.js migrate deploy
echo "[start] node server.js"
exec node server.js
