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

# Worker + die Pakete, die standalone nicht mitträgt
# (Worker-Laufzeit und Migrations-CLI).
COPY --from=builder --chown=nextjs:nodejs /app/worker ./worker
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/node-cron ./node_modules/node-cron
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/uuid ./node_modules/uuid

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Default = App. Der Worker-Service überschreibt den CMD mit: node worker/index.mjs
CMD ["node", "server.js"]
