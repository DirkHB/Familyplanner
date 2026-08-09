import { runBriefing } from "@/lib/overview/briefing-runner";
import { proHaushalt } from "@/lib/haushalt/runde";

export const dynamic = "force-dynamic";

/** Briefings — vom Worker: täglich 7:00 (morgen), sonntags 12:00 (woche). */
export async function POST(req: Request) {
  const secret = req.headers.get("x-worker-secret");
  if (!process.env.WORKER_SECRET || secret !== process.env.WORKER_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") === "woche" ? "woche" : "morgen";
  try {
    // Eine Runde durch alle Haushalte. Der Text je Haushalt bleibt dort, wo
    // er hingehört — in der Briefing-Tabelle; hier zählt nur, wie viele
    // Mitteilungen rausgingen.
    const res = await proHaushalt(async () => ({ pushed: (await runBriefing(kind)).pushed }));
    return Response.json({ ok: true, kind, ...res });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
