// Familienplaner — Worker-Service.
// Eigener Prozess/Service auf demselben Sliplane-Server. node-cron als Scheduler,
// weil Sliplane keinen eingebauten Cron hat. Ein Absturz hier reißt die App nicht mit.
//
// Phase 0: Jobs sind Platzhalter, die ihren Lauf protokollieren. Die echte Logik
// (CalDAV-Sync, Nudge, Wochenreview) wird in den Phasen 1/2/4 eingehängt.

import cron from "node-cron";

const TZ = process.env.TZ || "Europe/Berlin";

function log(job, msg) {
  const ts = new Date().toISOString();
  console.log(JSON.stringify({ ts, service: "worker", job, msg }));
}

log("boot", `Worker gestartet · Zeitzone ${TZ}`);

// --- Kalender-Sync: alle 5 Minuten (Abschnitt 4) ---
const APP_URL = process.env.APP_INTERNAL_URL || process.env.AUTH_URL || "http://localhost:3000";

async function triggerSync() {
  if (!process.env.WORKER_SECRET) {
    log("calendar-sync", "Übersprungen — WORKER_SECRET nicht gesetzt.");
    return;
  }
  try {
    const res = await fetch(`${APP_URL}/api/internal/sync`, {
      method: "POST",
      headers: { "x-worker-secret": process.env.WORKER_SECRET },
    });
    const body = await res.json().catch(() => ({}));
    log("calendar-sync", `Status ${res.status} · ${JSON.stringify(body)}`);
  } catch (err) {
    log("calendar-sync", `Fehler: ${err?.message ?? err}`);
  }
}

cron.schedule("*/5 * * * *", triggerSync, { timezone: TZ });

// --- Täglicher Nudge für offene Anfragen: 09:00 (Abschnitt 6.3) ---
async function triggerNudge() {
  if (!process.env.WORKER_SECRET) {
    log("daily-nudge", "Übersprungen — WORKER_SECRET nicht gesetzt.");
    return;
  }
  try {
    const res = await fetch(`${APP_URL}/api/internal/nudge`, {
      method: "POST",
      headers: { "x-worker-secret": process.env.WORKER_SECRET },
    });
    const body = await res.json().catch(() => ({}));
    log("daily-nudge", `Status ${res.status} · ${JSON.stringify(body)}`);
  } catch (err) {
    log("daily-nudge", `Fehler: ${err?.message ?? err}`);
  }
}

cron.schedule("0 9 * * *", triggerNudge, { timezone: TZ });

// --- Aufgaben-Erinnerungen: alle 5 Minuten (verschickt fällige remindAt) ---
async function triggerReminders() {
  if (!process.env.WORKER_SECRET) return;
  try {
    const res = await fetch(`${APP_URL}/api/internal/reminders`, {
      method: "POST",
      headers: { "x-worker-secret": process.env.WORKER_SECRET },
    });
    const body = await res.json().catch(() => ({}));
    if (body?.sent > 0 || !res.ok) log("todo-reminders", `Status ${res.status} · ${JSON.stringify(body)}`);
  } catch (err) {
    log("todo-reminders", `Fehler: ${err?.message ?? err}`);
  }
}

cron.schedule("*/5 * * * *", triggerReminders, { timezone: TZ });

// --- Wochenreview: Sonntag 19:00 — Push "Eure Woche" an beide ---
cron.schedule(
  "0 19 * * 0",
  async () => {
    if (!process.env.WORKER_SECRET) return;
    try {
      const res = await fetch(`${APP_URL}/api/internal/weekly`, {
        method: "POST",
        headers: { "x-worker-secret": process.env.WORKER_SECRET },
      });
      const body = await res.json().catch(() => ({}));
      log("weekly-review", `Status ${res.status} · ${JSON.stringify(body)}`);
    } catch (err) {
      log("weekly-review", `Fehler: ${err?.message ?? err}`);
    }
  },
  { timezone: TZ },
);

// Mini-HTTP-Server nur für den Sliplane-Healthcheck: Sliplane verlangt von jedem
// Service eine HTTP-Antwort auf "/", sonst landet er in einer Redeploy-Schleife
// (gelernt am Postgres-Container). Antwortet 200 mit Status der Jobs.
import http from "node:http";

const healthPort = Number(process.env.PORT || 3000);
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "worker", tz: TZ }));
  })
  .listen(healthPort, "0.0.0.0", () => {
    log("health", `Healthcheck-Server auf Port ${healthPort}`);
  });

// Sauberes Herunterfahren.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    log("shutdown", `Signal ${sig} — Worker beendet.`);
    process.exit(0);
  });
}
