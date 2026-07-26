import "server-only";
import { prisma } from "@/lib/prisma";
import { evaluateNudge } from "./nudge";
import { isQuietHours, mergePrefs } from "@/lib/push/quiet-hours";
import { sendPushToUser } from "@/lib/push/webpush";
import { sendEmail } from "@/lib/email/send";
import { nudgeEmail } from "@/lib/email/templates";

const APP_URL = process.env.AUTH_URL || "https://planyourweek.app";

export type NudgeSummary = { pushed: number; emailed: number; considered: number };

/**
 * Täglicher Nudge (Abschnitt 6.3): freundlich an offene Anfragen erinnern.
 * Push höchstens einmal/Tag, E-Mail-Eskalation ab 3 Tagen, Ruhezeiten werden respektiert.
 */
export async function runDailyNudge(now: Date = new Date()): Promise<NudgeSummary> {
  const summary: NudgeSummary = { pushed: 0, emailed: 0, considered: 0 };

  const open = await prisma.request.findMany({
    where: { status: "open" },
    include: { toUser: true },
  });

  // Pro Empfänger gruppieren, damit E-Mail eine Sammel-Erinnerung sein kann.
  const byUser = new Map<string, typeof open>();
  for (const r of open) {
    const list = byUser.get(r.toUserId) ?? [];
    list.push(r);
    byUser.set(r.toUserId, list);
  }

  for (const [userId, reqs] of byUser) {
    const user = reqs[0].toUser;
    const prefs = mergePrefs(user.notificationPrefs);
    if (!prefs.requests) continue;

    const dueForPush: typeof reqs = [];
    const dueForEmail: typeof reqs = [];
    for (const r of reqs) {
      summary.considered++;
      const d = evaluateNudge({ status: r.status, createdAt: r.createdAt, lastNudgeAt: r.lastNudgeAt }, now);
      if (d.shouldPushToday) dueForPush.push(r);
      if (d.shouldEmail) dueForEmail.push(r);
    }

    const quiet = isQuietHours(now, prefs.quietStart, prefs.quietEnd);

    if (dueForPush.length && !quiet) {
      const n = await sendPushToUser(userId, {
        title: dueForPush.length === 1 ? "Eine Frage wartet auf dich" : `${dueForPush.length} Fragen warten`,
        body: "Kleine Erinnerung — ein Tap genügt.",
        url: "/woche",
        tag: "nudge",
      });
      summary.pushed += n;
    }

    if (dueForEmail.length && user.email) {
      try {
        const { subject, html, text } = nudgeEmail(user.email, dueForEmail.length, `${APP_URL}/woche`);
        await sendEmail({ to: user.email, subject, html, text });
        summary.emailed++;
      } catch {
        /* E-Mail-Fehler nicht fatal */
      }
    }

    // lastNudgeAt für alle heute berücksichtigten Anfragen setzen.
    const touched = new Set([...dueForPush, ...dueForEmail].map((r) => r.id));
    if (touched.size) {
      await prisma.request.updateMany({
        where: { id: { in: [...touched] } },
        data: { lastNudgeAt: now },
      });
    }
  }

  await prisma.activityLog.create({
    data: { entityType: "nudge", entityId: "daily", action: "nudge_run", actor: "worker", detail: { ...summary } },
  });

  return summary;
}
