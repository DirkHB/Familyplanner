import "server-only";
import { prisma } from "@/lib/prisma";
import { getRangeData } from "@/lib/calendar/range-data";
import { dayKey } from "@/lib/calendar/format";
import { mergePrefs } from "@/lib/push/quiet-hours";
import { notifyUserId } from "@/lib/push/notify";
import { evaluateFrist, fristLabel, FRIST_STUNDEN } from "./frist";

/**
 * Anfragen mit Frist (stündlich): Eine offene Frage, deren Termin in weniger
 * als einem Tag beginnt, braucht jetzt eine Entscheidung — nicht morgen früh
 * um neun, wenn der tägliche Nudge das nächste Mal läuft.
 *
 * Angestoßen wird die Person, die antworten soll, höchstens einmal am Tag je
 * Anfrage. Der Anstoß setzt `lastNudgeAt`; damit fällt der tägliche Nudge zu
 * derselben Anfrage aus und niemand liest dasselbe zweimal.
 */

export type FristSummary = { considered: number; pushed: number };

export async function runFristCheck(now: Date = new Date()): Promise<FristSummary> {
  const summary: FristSummary = { considered: 0, pushed: 0 };

  const offen = await prisma.request.findMany({
    where: { status: "open" },
    include: { toUser: true, fromUser: { select: { email: true, name: true } } },
  });
  if (offen.length === 0) return summary;

  // Termine im Fristfenster einmal holen — daraus kommt der Stichtag.
  const bis = new Date(now.getTime() + (FRIST_STUNDEN + 1) * 3_600_000);
  const { occurrences } = await getRangeData(now, bis);
  const startFuerUid = new Map<string, Date>();
  for (const o of occurrences) {
    const vorhanden = startFuerUid.get(o.uid);
    if (!vorhanden || o.start < vorhanden) startFuerUid.set(o.uid, o.start);
  }

  for (const r of offen) {
    // Der Stichtag ist der Termin, um den es geht — ersatzweise ein gesetztes
    // „bis wann". Ohne beides gibt es keine Frist, nur den täglichen Nudge.
    const stichtag = (r.eventUid ? startFuerUid.get(r.eventUid) : null) ?? r.dueDate ?? null;
    const d = evaluateFrist({ status: r.status, stichtag, lastNudgeAt: r.lastNudgeAt }, now);
    if (!d.anstossen || !stichtag) continue;
    summary.considered++;

    const prefs = mergePrefs(r.toUser.notificationPrefs);
    if (!prefs.requests) continue;

    // Ruhezeiten prüft `notifyUserId` selbst und liefert dann 0. Weil
    // `lastNudgeAt` nur bei echtem Versand gesetzt wird, heißt Nachtruhe hier
    // verschieben statt verwerfen — der nächste stündliche Lauf nimmt die
    // Anfrage wieder mit.
    const n = await notifyUserId(r.toUserId, {
      title: `Entscheidung nötig — ${fristLabel(stichtag, now)}`,
      body: r.question,
      url: r.eventUid ? `/termin/${encodeURIComponent(r.eventUid)}` : "/anfragen",
      // Fester Anker je Anfrage und Tag: Ein zweiter Lauf ersetzt die
      // Mitteilung, statt sie zu stapeln.
      tag: `frist-${r.id}-${dayKey(now)}`,
    }).catch(() => 0);

    if (n > 0) {
      summary.pushed++;
      await prisma.request.update({ where: { id: r.id }, data: { lastNudgeAt: now } }).catch(() => null);
    }
  }

  return summary;
}
