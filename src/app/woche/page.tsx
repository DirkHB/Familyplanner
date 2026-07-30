import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { WeekView, type TodayFocus } from "@/components/week/WeekView";
import { buildWeek } from "@/lib/calendar/view-model";
import { getRangeData } from "@/lib/calendar/range-data";
import { startOfDayBerlin, formatDateHeader, greetingFor, formatTime, dayKey } from "@/lib/calendar/format";
import { displayNameForEmail } from "@/lib/auth/allowlist";
import { getOpenRequestsForUser } from "@/lib/requests/repository";
import { buildRequestVM } from "@/lib/requests/view-model";

export const dynamic = "force-dynamic";

/** Startbildschirm: Heute-Fokus + vertikale Wochenliste (Abschnitt 6.1). */
export default async function WochePage() {
  const session = await auth();
  const name = displayNameForEmail(session?.user?.email);

  const now = new Date();
  const from = startOfDayBerlin(now);
  const to = new Date(from.getTime() + 10 * 86_400_000);

  const { occurrences, metaByUid, careByOcc } = await getRangeData(from, to);
  const days = buildWeek(occurrences, metaByUid, now, careByOcc);

  const requests = session?.user?.id
    ? (await getOpenRequestsForUser(session.user.id)).map((r) => buildRequestVM(r, now))
    : [];

  // Heute-Fokus: nächster Termin heute + Betreuung + fällige Aufgaben.
  const todayKey = dayKey(now);
  const todayOcc = occurrences
    .filter((o) => dayKey(o.start) === todayKey && !o.allDay && o.end >= now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const next = todayOcc[0] ?? null;
  const nextCare = next ? careByOcc.get(`${next.uid}:${todayKey}`) : undefined;
  const todosDue = await prisma.todo
    .count({ where: { status: "offen", dueDate: { gte: from, lt: new Date(from.getTime() + 86_400_000) } } })
    .catch(() => 0);

  const focus: TodayFocus = {
    nextTitle: next?.summary ?? null,
    nextTime: next ? formatTime(next.start) : null,
    careStatus:
      next && nextCare && nextCare.status !== "keine"
        ? nextCare.status === "offen"
          ? "offen"
          : "da"
        : null,
    carePerson: nextCare?.person ?? null,
    todosDue,
  };

  return (
    <WeekView
      greetingName={name}
      greeting={greetingFor(now)}
      dateLabel={formatDateHeader(now)}
      days={days}
      requests={requests}
      focus={focus}
    />
  );
}
