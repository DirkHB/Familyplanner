import { runBriefing } from "@/lib/overview/briefing-runner";
import { ordneNeueMehrtaegigeEin } from "@/lib/klaerung/einordnung-lauf";
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
    const res = await proHaushalt(async () => {
      // Vor dem Morgen-Briefing einmal nachziehen: Das Briefing soll wissen,
      // ob ihr heute überhaupt zu Hause seid, bevor es etwas vorschlägt. Und
      // es ist der eine Lauf am Tag, der auch dann stattfindet, wenn sich im
      // Kalender tagelang nichts rührt.
      const eingeordnet =
        kind === "morgen" ? await ordneNeueMehrtaegigeEin().catch(() => 0) : 0;
      return { pushed: (await runBriefing(kind)).pushed, eingeordnet };
    });
    return Response.json({ ok: true, kind, ...res });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
