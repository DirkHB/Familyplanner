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
cron.schedule(
  "*/5 * * * *",
  async () => {
    log("calendar-sync", "Tick — Phase 1 hängt hier den CalDAV-Pull/Push ein.");
    // TODO(Phase 1): await runCalendarSync()
  },
  { timezone: TZ },
);

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
