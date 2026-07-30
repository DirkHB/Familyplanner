import "server-only";
import { prisma } from "@/lib/prisma";
import { getRangeData } from "@/lib/calendar/range-data";
import { startOfDayBerlin, dayKey, formatTime, formatWeekday, formatMonthDay } from "@/lib/calendar/format";
import { buildOverview, type Overview, type OverviewEvent, type OverviewTodo } from "./build";

/** Datenbeschaffung für den Überblick: Termine + Betreuung + offene Aufgaben. */

const dueFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/Berlin",
});

export type Horizon = "heute-bis-sonntag" | "naechste-woche";

/** Zeitfenster: bis Sonntag (Morgen-Briefing) bzw. Mo–So der Folgewoche. */
export function horizonRange(kind: Horizon, now: Date): { from: Date; to: Date } {
  const today = startOfDayBerlin(now);
  const dow = (new Date(today).getUTCDay() + 6) % 7; // 0 = Montag
  if (kind === "heute-bis-sonntag") {
    return { from: today, to: new Date(today.getTime() + (7 - dow) * 86_400_000) };
  }
  const nextMonday = new Date(today.getTime() + (7 - dow) * 86_400_000);
  return { from: nextMonday, to: new Date(nextMonday.getTime() + 7 * 86_400_000) };
}

export async function getOverview(kind: Horizon, now: Date = new Date()): Promise<Overview> {
  const { from, to } = horizonRange(kind, now);
  const { occurrences, careByOcc } = await getRangeData(from, to);

  const events: OverviewEvent[] = occurrences
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((o) => {
      const k = dayKey(o.start);
      const c = o.allDay ? undefined : careByOcc.get(`${o.uid}:${k}`);
      return {
        dayKey: k,
        dayLabel: `${formatWeekday(o.start).slice(0, 2)}, ${formatMonthDay(o.start)}`,
        time: o.allDay ? "" : formatTime(o.start),
        title: o.summary,
        uid: o.uid,
        allDay: o.allDay,
        care: c && c.status !== "keine" ? (c.status === "offen" ? "offen" : "da") : null,
        carePerson: c?.person ?? null,
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
  return prisma.briefing.findFirst({ where: { kind }, orderBy: { createdAt: "desc" } });
}

export async function saveBriefing(kind: "morgen" | "woche", day: string, summary: string) {
  return prisma.briefing.upsert({
    where: { kind_dayKey: { kind, dayKey: day } },
    create: { kind, dayKey: day, summary },
    update: { summary },
  });
}
