# Familienplaner — ein Image, zwei Services (App + Worker).
# Multi-Stage, Next.js output:"standalone" → kleines, vorhersagbares Image.
# App-Start:    node server.js
# Worker-Start: node worker/index.mjs
# (Beide Sliplane-Services nutzen dasselbe Image, nur anderer Start-Command.)

# ---------- Basis ----------
FROM node:22-bookworm-slim AS base
# OpenSSL für die Prisma-Query-Engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------- Dependencies ----------
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci
# Prisma-Client generieren (braucht nur das Schema, keine DB).
COPY prisma ./prisma
RUN npx prisma generate

# ---------- Build ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Kein DB-/Secret-Zugriff nötig beim Build; Dummies reichen, damit env-Reads nicht failen.
# Echte Werte kommen zur Laufzeit aus den Sliplane-Env-Variablen.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV AUTH_SECRET="build-only-not-a-real-secret"
RUN npm run build

# Aufräumen VOR dem Kopieren in den Runner — der bekommt diese node_modules 1:1.
# Ohne das lag ein komplettes Entwickler-Werkzeugkasten im Image (891 MB): TypeScript,
# Vitest, Playwright, Tailwind — und vor allem @next/swc, der Rust-Compiler von Next.js
# mit je einem ~130-MB-Binary für glibc und musl. Genau daran ist das Ausrollen
# gescheitert: "no space left on device" beim Schreiben von next-swc.linux-x64-gnu.node.
#   1. Dev-Abhängigkeiten raus (prisma steht bewusst unter "dependencies",
#      weil `migrate deploy` beim Containerstart läuft).
#   2. Prisma-Client neu erzeugen — npm prune räumt node_modules/.prisma mit weg.
#   3. @next (nur SWC-Compiler, reine Bauzeit) und next löschen: Die standalone-
#      Ausgabe bringt ihr eigenes, getracktes `next` mit, das im Runner zuerst
#      kopiert wird und stehen bleibt (COPY überschreibt, löscht aber nie).
RUN npm prune --omit=dev \
  && npx prisma generate \
  && rm -rf node_modules/@next node_modules/next node_modules/.cache

# ---------- Runner ----------
FROM base AS runner
ENV NODE_ENV=production
ENV TZ=Europe/Berlin
# Non-root.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# App: standalone-Ausgabe (server.js + getracktes, schlankes node_modules).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Schema + Migrationen (für `prisma migrate deploy`).
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Versionierte KI-Prompts (zur Laufzeit gelesen).
COPY --from=builder --chown=nextjs:nodejs /app/prompts ./prompts

# Worker-Quelle.
COPY --from=builder --chown=nextjs:nodejs /app/worker ./worker

# Produktions-node_modules darüberlegen (im builder schon entrümpelt). Nötig, weil das
# standalone-Bundle zwei Dinge nicht kennt: die Prisma-CLI für `migrate deploy` samt
# ihrer Transitiv-Abhängigkeiten (effect, @prisma/config) und node-cron für den Worker.
# COPY legt darüber, ohne zu löschen — das getrackte `next` aus dem standalone-Copy
# oben bleibt also erhalten.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Startskript: Migration + Serverstart in einem (kein CMD-Override nötig).
COPY --from=builder --chown=nextjs:nodejs /app/start.sh ./start.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Default = App (Migration + Start). Der Worker-Service überschreibt den CMD
# mit einem Einzelbefehl ohne "&&": node worker/index.mjs
CMD ["sh", "start.sh"]
