import { runAufgabenFenster } from "@/lib/todos/fenster-runner";
import { proHaushalt } from "@/lib/haushalt/runde";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Aufgaben-Anstoß im freien Fenster — vom Worker-Cron (alle 15 Min). */
export async function POST(req: Request) {
  const secret = req.headers.get("x-worker-secret");
  if (!process.env.WORKER_SECRET || secret !== process.env.WORKER_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    // Eine Runde durch alle Haushalte — die Aufgabe selbst weiß nichts davon.
    const summary = await proHaushalt(() => runAufgabenFenster());
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
