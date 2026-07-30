import { runTodoReminders } from "@/lib/todos/repository";

export const dynamic = "force-dynamic";

/** Aufgaben-Erinnerungen — vom Worker alle 5 Min per Shared-Secret angestoßen. */
export async function POST(req: Request) {
  const secret = req.headers.get("x-worker-secret");
  if (!process.env.WORKER_SECRET || secret !== process.env.WORKER_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const summary = await runTodoReminders();
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
