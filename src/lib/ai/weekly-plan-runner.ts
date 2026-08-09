import "server-only";
import { prisma } from "@/lib/prisma";
import { getAnthropic, AI_MODEL } from "./client";
import { getOccurrencesForRange } from "@/lib/calendar/repository";
import { groupByDay, formatTime, formatDateHeader, startOfDayBerlin } from "@/lib/calendar/format";
import { categoryOf, guessCategory } from "@/lib/calendar/categories";
import { getOpenRequestsForUser } from "@/lib/requests/repository";
import { notnameAusEmail } from "@/lib/auth/allowlist";
import { getFairness } from "@/lib/fairness/repository";
import { activePatternLabels } from "@/lib/patterns/repository";
import { buildPlanningContext, type ContextDay } from "./planning-context";
import { generateWeeklyPlan, type WeeklyPlan } from "./weekly-plan";

/** Baut den Planungs-Kontext aus der DB (kommende 7 Tage). */
export async function buildContextFromDb(userId: string | null, now: Date = new Date()) {
  const from = startOfDayBerlin(now);
  const to = new Date(from.getTime() + 7 * 86_400_000);

  const occurrences = await getOccurrencesForRange(from, to);

  // Betreuungsstatus je (uid, Tag) laden.
  const careRows = await prisma.careAssignment.findMany({
    where: { occurrenceDate: { gte: from, lte: to } },
  });
  const careKey = (uid: string, d: Date) =>
    `${uid}:${Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())}`;
  const careMap = new Map(careRows.map((r) => [careKey(r.eventUid, r.occurrenceDate), r.status]));

  const uids = [...new Set(occurrences.map((o) => o.uid))];
  const details = await prisma.eventDetail.findMany({ where: { eventUid: { in: uids } } });
  const catByUid = new Map(details.map((d) => [d.eventUid, d.category]));

  const groups = groupByDay(occurrences, now, { von: from, bis: to });
  const days: ContextDay[] = groups.map((g) => ({
    weekday: g.weekday,
    dayNumber: g.dayNumber,
    events: g.occurrences.map((o) => {
      const cat = catByUid.get(o.uid);
      const label = (cat ? categoryOf(cat) : categoryOf(guessCategory(o.summary))).label;
      const status = careMap.get(careKey(o.uid, o.start));
      const care =
        status === "offen"
          ? { status: "offen" as const, label: "Betreuung offen" }
          : status === "geklaert" || status === "zugesagt" || status === "extern"
            ? { status: "geklaert" as const, label: "Betreuung geklärt" }
            : null;
      return { time: o.allDay ? "" : formatTime(o.start), title: o.summary, categoryLabel: label, care };
    }),
  }));

  const openRequests = userId
    ? (await getOpenRequestsForUser(userId)).map(
        (r) => `${r.fromUser.name ?? notnameAusEmail(r.fromUser.email)} fragt: ${r.question}`,
      )
    : [];

  const fairness = await getFairness(6, now);
  const patterns = await activePatternLabels();

  return buildPlanningContext({
    todayLabel: formatDateHeader(now),
    days,
    openRequests,
    fairnessLabel: fairness.label,
    patterns,
  });
}

export async function runWeeklyPlan(userId: string | null, now: Date = new Date()): Promise<WeeklyPlan> {
  const ctx = await buildContextFromDb(userId, now);
  const client = getAnthropic();
  return generateWeeklyPlan(client, AI_MODEL, ctx);
}

/** Sonntagabend-Push „Eure Woche" an beide (Worker, So 19:00). */
export async function runWeeklySummaryPush(): Promise<{ pushed: number }> {
  const { haushaltProfil, stelleUserSicher } = await import("@/lib/haushalt/profil");
  const { notifyUserId } = await import("@/lib/push/notify");
  const { aiConfigured } = await import("./client");

  let body = "Werft einen Blick auf eure Woche — Termine, Betreuung, Aufgaben.";
  try {
    if (aiConfigured()) {
      const plan = await runWeeklyPlan(null);
      if (plan.summary) body = plan.summary.slice(0, 160);
    }
  } catch {
    /* Fallback-Text reicht */
  }

  let pushed = 0;
  const profil = await haushaltProfil();
  for (const { email } of profil.erwachsene) {
    const user = await stelleUserSicher(email);
    pushed += await notifyUserId(user.id, {
      title: "Eure Woche 🌱",
      body,
      url: "/planung",
      tag: "weekly-summary",
    });
  }
  return { pushed };
}
