import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { personForEmail } from "@/lib/auth/allowlist";
import { listTodos } from "@/lib/todos/repository";
import { buildTodoVM, groupTodos } from "@/lib/todos/group";
import { getRangeData } from "@/lib/calendar/range-data";
import { startOfDayBerlin, formatMonthDay, formatWeekday, formatTime, dayKey } from "@/lib/calendar/format";
import { AufgabenClient, type CareDay, type EventTasks } from "./AufgabenClient";

export const dynamic = "force-dynamic";

/** Aufgaben: gemeinsame To-Dos nach ETA + Vorbereitungs-Punkte der nächsten Termine. */
export default async function AufgabenPage() {
  const session = await auth();
  const me = personForEmail(session?.user?.email ?? "");

  const now = new Date();
  // Hinweis: Betreuungs-Aufgaben entstehen ausschließlich im Moment der Übernahme
  // („Ich mache es" / „Ja"-Antwort). Ein Backfill beim Seitenaufruf stand hier kurz
  // und wurde entfernt — er hat erledigte/gelöschte Aufgaben wieder neu angelegt.
  const rows = await listTodos();
  // Betreuungs-Aufgaben bekommen ihren eigenen Block „Wer ist bei Nicolas?"
  // mit Uhrzeit und Person — in der normalen Liste tauchen sie nicht mehr auf.
  const istBetreuung = (r: { eventUid: string | null; title: string }) =>
    !!r.eventUid && r.title.startsWith("Baby betreuen");
  const groups = groupTodos(
    rows.filter((r) => !istBetreuung(r)).map((r) => buildTodoVM(r, now)),
    now,
  );

  // „Aus Terminen": offene Checklisten der nächsten 30 Tage.
  const from = startOfDayBerlin(now);
  const to = new Date(from.getTime() + 30 * 86_400_000);
  const { occurrences } = await getRangeData(from, to);
  const firstOcc = new Map<string, Date>();
  for (const o of occurrences) if (!firstOcc.has(o.uid)) firstOcc.set(o.uid, o.start);
  const uids = [...firstOcc.keys()];

  const details = uids.length
    ? await prisma.eventDetail.findMany({
        where: { eventUid: { in: uids } },
        select: { eventUid: true, prepChecklist: true },
      })
    : [];
  const titleByUid = new Map(occurrences.map((o) => [o.uid, o.summary]));

  const eventTasks: EventTasks[] = details
    .map((d) => {
      const items = Array.isArray(d.prepChecklist)
        ? (d.prepChecklist as { text: string; done: boolean }[]).map((it, idx) => ({ ...it, idx }))
        : [];
      return {
        eventUid: d.eventUid,
        title: titleByUid.get(d.eventUid) ?? "Termin",
        dayLabel: formatMonthDay(firstOcc.get(d.eventUid) ?? now),
        sort: (firstOcc.get(d.eventUid) ?? now).getTime(),
        items,
      };
    })
    .filter((e) => e.items.some((it) => !it.done))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, 10);

  // Betreuungs-Block: offene Übernahmen, nach Tag gestaffelt, mit dem exakten
  // Zeitraum aus dem Termin (Vorkommen am jeweiligen Tag) und der Person.
  const occByDay = new Map(occurrences.map((o) => [`${o.uid}:${dayKey(o.start)}`, o]));
  const todayKey = dayKey(now);
  const careMap = new Map<string, CareDay>();
  for (const r of rows) {
    if (!istBetreuung(r) || r.status !== "offen") continue;
    const key = r.dueDate ? dayKey(r.dueDate) : "9999-99-99";
    const occ = r.dueDate ? occByDay.get(`${r.eventUid}:${key}`) : undefined;
    const day = careMap.get(key) ?? {
      key,
      label: r.dueDate
        ? `${formatWeekday(r.dueDate).slice(0, 2)}, ${formatMonthDay(r.dueDate)}`
        : "Demnächst",
      past: key !== "9999-99-99" && key < todayKey,
      slots: [],
    };
    day.slots.push({
      id: r.id,
      title: r.title.replace(/^Baby betreuen · /, ""),
      timeLabel: occ && !occ.allDay ? `${formatTime(occ.start)}–${formatTime(occ.end)}` : null,
      sort: occ ? occ.start.getTime() : (r.dueDate?.getTime() ?? 0),
      person: r.assignee === "dirk" || r.assignee === "constanze" ? r.assignee : null,
    });
    careMap.set(key, day);
  }
  const careDays = [...careMap.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((d) => ({ ...d, slots: d.slots.sort((a, b) => a.sort - b.sort) }));

  return <AufgabenClient groups={groups} me={me} eventTasks={eventTasks} careDays={careDays} />;
}
