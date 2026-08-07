import "server-only";
import { prisma } from "@/lib/prisma";
import { haushaltId } from "@/lib/haushalt/id";
import { getRangeData } from "@/lib/calendar/range-data";
import { startOfDayBerlin, dayKey, formatTime, formatWeekday, formatMonthDay } from "@/lib/calendar/format";
import { buildOverview, type Overview, type OverviewEvent, type OverviewTodo } from "./build";
import { horizonRange, type Horizon } from "./horizon";
import { isCareGap } from "@/lib/care/gaps";
import { getDismissedTitleKeys } from "@/lib/care/rules";

export { horizonRange, defaultHorizon, berlinWeekday, type Horizon } from "./horizon";

/** Datenbeschaffung für den Überblick: Termine + Betreuung + offene Aufgaben. */

const dueFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/Berlin",
});

export async function getOverview(kind: Horizon, now: Date = new Date()): Promise<Overview> {
  const { from, to } = horizonRange(kind, now);
  const [{ occurrences, careByOcc }, abgewinkt] = await Promise.all([
    getRangeData(from, to),
    getDismissedTitleKeys(),
  ]);

  const events: OverviewEvent[] = occurrences
    // Nur was noch kommt; ein gerade laufender Termin bleibt sichtbar.
    .filter((o) => o.end > from)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((o) => {
      const k = dayKey(o.start);
      const c = o.allDay ? undefined : careByOcc.get(`${o.uid}:${k}`);
      // Noch nie besprochen, fällt aber in Nicolas' Wachzeit → offene Frage.
      // Ohne das blieben genau die Termine unsichtbar, über die noch niemand
      // nachgedacht hat — und das sind die, die im Alltag wehtun.
      const luecke =
        !c &&
        isCareGap(
          { uid: o.uid, title: o.summary, start: o.start, end: o.end, allDay: o.allDay, hasCareDecision: false },
          abgewinkt,
        );
      return {
        dayKey: k,
        dayLabel: `${formatWeekday(o.start).slice(0, 2)}, ${formatMonthDay(o.start)}`,
        time: o.allDay ? "" : formatTime(o.start),
        title: o.summary,
        uid: o.uid,
        allDay: o.allDay,
        care: c && c.status !== "keine" ? (c.status === "offen" ? "offen" : "da") : luecke ? "luecke" : null,
        carePerson: c?.person ?? null,
        occurrenceISO: o.start.toISOString(),
      };
    });

  const rows = await prisma.todo.findMany({
    where: { status: "offen", OR: [{ dueDate: null }, { dueDate: { lt: to } }] },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
    take: 50,
  });
  const todayKey = dayKey(now);
  const todos: OverviewTodo[] = rows.map((t) => ({
    id: t.id,
    title: t.title,
    dueLabel: t.dueDate ? dueFmt.format(t.dueDate) : null,
    overdue: !!t.dueDate && dayKey(t.dueDate) < todayKey,
    assignee: t.assignee === "constanze" || t.assignee === "dirk" ? t.assignee : null,
  }));

  return buildOverview({ events, todos });
}

/** Zuletzt gespeichertes Briefing (Push verlinkt hierher). */
export async function getLatestBriefing(kind: "morgen" | "woche") {
  return prisma.briefing.findFirst({
    where: { householdId: haushaltId(), kind },
    orderBy: { createdAt: "desc" },
  });
}

export async function saveBriefing(kind: "morgen" | "woche", day: string, summary: string) {
  return prisma.briefing.upsert({
    where: { householdId_kind_dayKey: { householdId: haushaltId(), kind, dayKey: day } },
    create: { householdId: haushaltId(), kind, dayKey: day, summary },
    update: { summary },
  });
}
