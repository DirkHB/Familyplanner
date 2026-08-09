import "server-only";
import { prisma } from "@/lib/prisma";
import { getRangeData } from "@/lib/calendar/range-data";
import { startOfDayBerlin, dayKey, formatTime } from "@/lib/calendar/format";
import { parseAllowlist } from "@/lib/auth/allowlist";
import { stelleUserSicher } from "@/lib/haushalt/profil";
import { notifyUserId } from "@/lib/push/notify";

/**
 * Der Abend-Check (Worker, 18:00): Steht in den nächsten ~26 Stunden ein
 * Termin, bei dem die Betreuung ausdrücklich offen ist — einer hat gefragt,
 * und entweder kam ein Nein oder noch gar nichts —, bekommen BEIDE einen
 * Push. Nicht nur der Fragesteller: Wenn keiner mehr hinschaut, steht ihr
 * morgen ohne jemanden für Nicolas da. Laut WSI-Befragung 2025 stopfen über
 * die Hälfte der Eltern Betreuungslücken in letzter Minute selbst — genau
 * diese Feuerwehr-Momente soll der Abend vorher abfangen.
 *
 * Bewusst eng gehalten: nur Status „offen" (die Frage läuft schon), nur das
 * 26-Stunden-Fenster, einmal am Tag. Unbesprochene Termine bekommen weiter
 * ihre Karte beim Öffnen — dafür braucht es keinen Push.
 */

export type AbendSummary = { considered: number; pushed: number };

export async function runCareAbend(now: Date = new Date()): Promise<AbendSummary> {
  const bis = new Date(now.getTime() + 26 * 3_600_000);
  const summary: AbendSummary = { considered: 0, pushed: 0 };

  const offene = await prisma.careAssignment.findMany({
    where: { status: "offen", occurrenceDate: { gte: startOfDayBerlin(now), lt: bis } },
  });
  if (offene.length === 0) return summary;

  /**
   * Läuft zu diesem Termin noch eine unbeantwortete Frage, kümmert sich der
   * Frist-Anstoß darum — der geht gezielt an die Person, die antworten soll,
   * statt beide anzustupsen. Sonst läse einer von beiden abends zweimal
   * dasselbe, und das ist der schnellste Weg, Mitteilungen abzuschalten.
   */
  const mitOffenerFrage = new Set(
    (
      await prisma.request.findMany({
        where: { status: "open", eventUid: { in: offene.map((a) => a.eventUid) } },
        select: { eventUid: true },
      })
    ).map((r) => r.eventUid!),
  );

  const { occurrences } = await getRangeData(now, bis);

  // Beide Nutzerzeilen sicherstellen — Pushes dürfen nie ins Leere gehen.
  const nutzer = await Promise.all(
    parseAllowlist(process.env.ALLOWED_EMAILS).map((email) => stelleUserSicher(email)),
  );

  for (const a of offene) {
    if (mitOffenerFrage.has(a.eventUid)) continue;
    const occ = occurrences.find(
      (o) => o.uid === a.eventUid && dayKey(o.start) === dayKey(a.occurrenceDate),
    );
    if (!occ || occ.start <= now || occ.start > bis) continue;
    summary.considered += 1;

    const wann = `${dayKey(occ.start) === dayKey(now) ? "heute" : "morgen"} ${formatTime(occ.start)}`;
    for (const u of nutzer) {
      await notifyUserId(u.id, {
        title: "Noch niemand bei Nicolas",
        body: `${occ.summary} — ${wann}. Babysitter geklärt?`,
        url: `/termin/${encodeURIComponent(a.eventUid)}`,
        // Fester Tag je Vorkommen: Ein zweiter Lauf ersetzt die Mitteilung,
        // statt sie zu stapeln.
        tag: `care-abend-${a.eventUid}-${dayKey(a.occurrenceDate)}`,
      }).catch(() => {});
    }
    summary.pushed += 1;
  }
  return summary;
}
