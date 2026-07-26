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
cron.schedule(
  "0 9 * * *",
  async () => {
    log("daily-nudge", "Tick — Phase 2 prüft offene Anfragen und pusht freundlich.");
    // TODO(Phase 2): await runDailyNudge()
  },
  { timezone: TZ },
);

// --- Wochenreview: Sonntag 19:00 (Abschnitt 6.5) ---
cron.schedule(
  "0 19 * * 0",
  async () => {
    log("weekly-review", "Tick — Phase 4 erzeugt den KI-Wochenblick.");
    // TODO(Phase 4): await runWeeklyReview()
  },
  { timezone: TZ },
);

// Sauberes Herunterfahren.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    log("shutdown", `Signal ${sig} — Worker beendet.`);
    process.exit(0);
  });
}
