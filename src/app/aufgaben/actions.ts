"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { personForEmail, type Person } from "@/lib/auth/allowlist";
import { createTodo, toggleTodo, deleteTodo, setTodoList } from "@/lib/todos/repository";
import { createTodoList } from "@/lib/todos/lists";
import { NEUE_LISTE } from "@/lib/todos/group";

export async function createTodoAction(
  _prev: { error: string | null } | null,
  fd: FormData,
): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.email) return { error: "Nicht angemeldet." };
  const title = String(fd.get("title") ?? "").trim();
  if (!title) return { error: "Bitte einen Titel eingeben." };

  const me = personForEmail(session.user.email);
  const rawAssignee = String(fd.get("assignee") ?? "");
  const assignee: Person | null =
    rawAssignee === "dirk" || rawAssignee === "constanze" ? rawAssignee : null;

  // Datum kommt als YYYY-MM-DD (Berlin) → Fälligkeit 09:00 Ortszeit als Referenzpunkt.
  const dueRaw = String(fd.get("dueDate") ?? "");
  const dueDate = dueRaw ? new Date(`${dueRaw}T09:00:00+02:00`) : null;

  // Erinnerung: am Fälligkeitstag um 09:00 (wenn gewünscht und Datum gesetzt).
  const remind = fd.get("remind") === "on" && dueDate ? dueDate : null;

  // „Neue Liste …" gewählt: erst die Liste anlegen, dann die Aufgabe hinein.
  // Gibt es den Namen schon, liefert createTodoList die vorhandene Liste —
  // die Aufgabe landet also richtig statt in einem Duplikat.
  let listId = String(fd.get("listId") ?? "") || null;
  if (listId === NEUE_LISTE) {
    const name = String(fd.get("listName") ?? "").trim();
    const res = name ? await createTodoList(name) : null;
    listId = res?.ok ? (res.id ?? null) : null;
  }

  await createTodo({
    title,
    notes: String(fd.get("notes") ?? ""),
    dueDate,
    assignee,
    createdBy: me,
    remindAt: remind,
    listId,
  });
  revalidatePath("/aufgaben");
  return { error: null };
}

/** Ein offener Einkaufs-Eintrag, der dieselbe Sache meint wie die Aufgabe. */
export type EinkaufTreffer = { id: string; text: string; laden: string | null };

/**
 * Aufgabe abhaken — und nachsehen, ob derselbe Vorgang noch auf dem
 * Einkaufszettel steht.
 *
 * Hintergrund: „Abschiedsgeschenk für Regina" war als Aufgabe erledigt, lag
 * aber weiter offen im Einkauf. Das Briefing liest beide Orte zusammen und
 * erzählte am nächsten Morgen von einem Geschenk, das längst gekauft war.
 * Abgehakt wird trotzdem nichts von allein — gefragt wird, geantwortet wird
 * mit einem Tipp.
 */
export async function toggleTodoAction(
  id: string,
): Promise<{ ok: boolean; einkauf?: EinkaufTreffer }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };

  const { prisma } = await import("@/lib/prisma");
  const vorher = await prisma.todo.findUnique({ where: { id }, select: { title: true, status: true } });
  await toggleTodo(id);
  revalidatePath("/aufgaben");

  // Nur beim Abhaken fragen, nicht beim Wiederöffnen.
  if (!vorher || vorher.status === "erledigt") return { ok: true };

  const { findeEinkaufTreffer } = await import("@/lib/todos/einkauf-match");
  const offene = await prisma.shoppingItem.findMany({
    where: { checkedAt: null, list: { kind: "haupt" } },
    select: { id: true, text: true, store: { select: { name: true } } },
    take: 100,
  });
  const treffer = findeEinkaufTreffer(vorher.title, offene);
  if (!treffer) return { ok: true };

  return {
    ok: true,
    einkauf: { id: treffer.id, text: treffer.text, laden: treffer.store?.name ?? null },
  };
}

export async function deleteTodoAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  await deleteTodo(id);
  revalidatePath("/aufgaben");
}

/** Avatar-Tap: Zuständigkeit durchwechseln (constanze → dirk → offen). */
export async function setTodoAssigneeAction(id: string, assignee: Person | null) {
  const session = await auth();
  if (!session?.user?.id) return;
  const { setTodoAssignee } = await import("@/lib/todos/repository");
  await setTodoAssignee(id, assignee);
  revalidatePath("/aufgaben");
}

/** Vorbereitungs-Punkt eines Termins aus der Aufgabenliste abhaken. */
export async function togglePrepItemAction(eventUid: string, index: number) {
  const session = await auth();
  if (!session?.user?.id) return;
  const { prisma } = await import("@/lib/prisma");
  const detail = await prisma.eventDetail.findUnique({ where: { eventUid } });
  if (!detail || !Array.isArray(detail.prepChecklist)) return;
  const prep = (detail.prepChecklist as { text: string; done: boolean }[]).map((it, i) =>
    i === index ? { ...it, done: !it.done } : it,
  );
  await prisma.eventDetail.update({ where: { eventUid }, data: { prepChecklist: prep } });
  revalidatePath("/aufgaben");
  revalidatePath(`/termin/${encodeURIComponent(eventUid)}`);
}

/**
 * Fälligkeit ändern. Rutscht sie um mehr als einen Tag nach hinten, erfährt
 * es der andere per Push — aber nur, wenn die Aufgabe ihn betrifft (er ist
 * zuständig oder hat sie angelegt). Sonst wäre es Rauschen.
 */
export async function setTodoDueAction(id: string, dueRaw: string | null) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return { ok: false };

  const { prisma } = await import("@/lib/prisma");
  const todo = await prisma.todo.findUnique({ where: { id } });
  if (!todo) return { ok: false };

  const neu = dueRaw ? new Date(`${dueRaw}T09:00:00+02:00`) : null;
  const spaeter =
    !!todo.dueDate && !!neu && neu.getTime() - todo.dueDate.getTime() > 86_400_000;

  await prisma.todo.update({
    where: { id },
    data: {
      dueDate: neu,
      // Auch hier zählt das Schieben mit — sichtbar wird es ab dem 3. Mal.
      ...(spaeter ? { shiftCount: { increment: 1 } } : {}),
      // Erinnerung wandert mit der Fälligkeit, falls eine gesetzt war.
      ...(todo.remindAt && neu ? { remindAt: neu, remindedAt: null } : {}),
    },
  });

  if (spaeter) {
    const me = personForEmail(session.user.email);
    const { resolvePartner } = await import("@/lib/requests/repository");
    const partner = await resolvePartner(session.user.id);
    const partnerPerson = partner ? personForEmail(partner.email) : null;
    const betroffen =
      partnerPerson !== null && (todo.assignee === partnerPerson || todo.createdBy === partnerPerson);
    if (partner && betroffen) {
      const { notifyUserId } = await import("@/lib/push/notify");
      const wann = new Intl.DateTimeFormat("de-DE", {
        weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Berlin",
      }).format(neu!);
      const wer = me === "constanze" ? "Constanze" : "Dirk";
      await notifyUserId(partner.id, {
        title: `${wer} hat „${todo.title}" verschoben`,
        body: `Jetzt bis ${wann}.`,
        url: "/aufgaben",
        tag: `todo-shift-${id}`,
      });
    }
  }

  revalidatePath("/aufgaben");
  revalidatePath("/woche");
  return { ok: true };
}

/**
 * Wichtig-Kennzeichen für Undatiertes. Bewusst nur ein Schalter statt der
 * Eisenhower-Matrix: „dringend" ist bereits ein Datum. Wer eine Aufgabe als
 * dringend erlebt, gibt ihr ein „bis wann" — dann steht sie ohnehin in Heute
 * oder Diese Woche. „Wichtig" ist das, was ein Datum allein nicht ausdrückt.
 */
export async function toggleTodoImportantAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const { prisma } = await import("@/lib/prisma");
  const todo = await prisma.todo.findUnique({ where: { id }, select: { important: true } });
  if (!todo) return { ok: false };
  await prisma.todo.update({ where: { id }, data: { important: !todo.important } });
  revalidatePath("/aufgaben");
  return { ok: true };
}

/** Aufgabe per Ziehen in eine andere Liste legen (`null` = ohne Liste). */
export async function setTodoListAction(id: string, listId: string | null) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await setTodoList(id, listId);
  revalidatePath("/aufgaben");
  return { ok: true };
}

/**
 * Aufgabe bearbeiten — aus dem Blatt, das sich beim Antippen der Zeile
 * öffnet. Ein Aufruf für alles, was dort steht; nur Angefasstes ändert sich.
 */
export async function updateTodoAction(
  id: string,
  input: { titel: string; notiz: string; dueRaw: string; listId: string },
): Promise<{ ok: boolean; grund?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, grund: "Nicht angemeldet." };
  const titel = input.titel.trim();
  if (!titel) return { ok: false, grund: "Der Titel darf nicht leer sein." };

  const { prisma } = await import("@/lib/prisma");
  const vorher = await prisma.todo.findUnique({ where: { id } });
  if (!vorher) return { ok: false, grund: "Aufgabe nicht gefunden." };

  const dueDate = input.dueRaw ? new Date(`${input.dueRaw}T09:00:00+02:00`) : null;
  await prisma.todo.update({
    where: { id },
    data: {
      title: titel,
      notes: input.notiz.trim() || null,
      dueDate,
      listId: input.listId || null,
      // Erinnerung wandert mit der Fälligkeit, falls eine gesetzt war.
      ...(vorher.remindAt && dueDate ? { remindAt: dueDate, remindedAt: null } : {}),
      ...(!dueDate ? { remindAt: null, remindedAt: null } : {}),
    },
  });
  revalidatePath("/aufgaben");
  revalidatePath("/woche");
  return { ok: true };
}
