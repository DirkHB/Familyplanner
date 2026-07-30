import "server-only";
import { prisma } from "@/lib/prisma";
import { parseAllowlist, displayNameForEmail } from "@/lib/auth/allowlist";
import { notifyUserId } from "@/lib/push/notify";
import { dayKey, greetingFor } from "@/lib/calendar/format";
import { briefingText } from "./build";
import { getOverview, saveBriefing } from "./repository";

/**
 * Briefings: täglich 7:00 („Guten Morgen" — heute + Rest der Woche) und
 * sonntags 12:00 („Neue Woche" — Mo–So). Text wird gespeichert, der Push
 * verlinkt in den Überblick, damit nichts flüchtig ist.
 */
export async function runBriefing(
  kind: "morgen" | "woche",
  now: Date = new Date(),
): Promise<{ pushed: number; summary: string }> {
  const overview = await getOverview(kind === "morgen" ? "bis-sonntag" : "naechste-woche", now);
  const summary = briefingText(overview, kind === "morgen" ? "morgen" : "woche");

  await saveBriefing(kind, dayKey(now), summary).catch(() => null);

  const title = kind === "morgen" ? `${greetingFor(now)} ☀️` : "Eure neue Woche 🌱";
  let pushed = 0;
  for (const email of parseAllowlist(process.env.ALLOWED_EMAILS)) {
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name: displayNameForEmail(email) },
      update: {},
    });
    pushed += await notifyUserId(user.id, {
      title,
      body: summary,
      url: "/ueberblick",
      tag: `briefing-${kind}`,
    });
  }
  return { pushed, summary };
}
