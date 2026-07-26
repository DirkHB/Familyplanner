import { runSyncForAllAccounts } from "@/lib/calendar/sync-engine";

export const dynamic = "force-dynamic";

/** Interner Sync-Endpunkt — vom Worker-Cron per Shared-Secret aufgerufen. */
export async function POST(req: Request) {
  const secret = req.headers.get("x-worker-secret");
  if (!process.env.WORKER_SECRET || secret !== process.env.WORKER_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const summary = await runSyncForAllAccounts();
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
