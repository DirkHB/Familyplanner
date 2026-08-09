import { runSyncForAllAccounts } from "@/lib/calendar/sync-engine";
import { proHaushalt } from "@/lib/haushalt/runde";

export const dynamic = "force-dynamic";

/** Interner Sync-Endpunkt — vom Worker-Cron per Shared-Secret aufgerufen. */
export async function POST(req: Request) {
  const secret = req.headers.get("x-worker-secret");
  if (!process.env.WORKER_SECRET || secret !== process.env.WORKER_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    // Eine Runde durch alle Haushalte — die Aufgabe selbst weiß nichts davon.
    // Die Fehlerliste wird zur Zahl: Welcher Kalender in welcher Familie
    // klemmt, steht im Log des jeweiligen Haushalts, nicht in einer Antwort,
    // die alle betrifft.
    const summary = await proHaushalt(async () => {
      const s = await runSyncForAllAccounts();
      return { calendars: s.calendars, upserted: s.upserted, deleted: s.deleted, fehlerhafteKalender: s.errors.length };
    });
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
