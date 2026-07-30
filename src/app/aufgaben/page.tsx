import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { personForEmail } from "@/lib/auth/allowlist";
import { ensureCareTodo } from "@/lib/requests/repository";
import { listTodos } from "@/lib/todos/repository";
import { buildTodoVM, groupTodos } from "@/lib/todos/group";
import { getRangeData } from "@/lib/calendar/range-data";
import { startOfDayBerlin, formatMonthDay } from "@/lib/calendar/format";
import { AufgabenClient, type EventTasks } from "./AufgabenClient";

export const dynamic = "force-dynamic";

/** Aufgaben: gemeinsame To-Dos nach ETA + Vorbereitungs-Punkte der nächsten Termine. */
export default async function AufgabenPage() {
  const session = await auth();
  const me = personForEmail(session?.user?.email ?? "");

  const now = new Date();

  // Selbstheilung: für bereits geklärte, kommende Betreuungen fehlende
  // „Baby betreuen"-Aufgaben nachziehen (idempotent, wenige Zeilen).
  try {
    const upcoming = await prisma.careAssignment.findMany({
      where: {
        occurrenceDate: { gte: startOfDayBerlin(now) },
        status: { in: ["geklaert", "zugesagt"] },
        responsibleUserId: { not: null },
      },
      include: { responsible: { select: { email: true } } },
      take: 25,
    });
    for (const a of upcoming) {
      if (!a.responsible) continue;
      const event = await prisma.event.findFirst({
        where: { uid: a.eventUid },
        select: { title: true },
      });
      if (event) {
        await ensureCareTodo(a.eventUid, event.title, personForEmail(a.responsible.email), a.occurrenceDate);
      }
    }
  } catch {
    /* Komfort, nie blockierend */
  }

  const rows = await listTodos();
  const groups = groupTodos(rows.map((r) => buildTodoVM(r, now)), now);

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

  return <AufgabenClient groups={groups} me={me} eventTasks={eventTasks} />;
}
