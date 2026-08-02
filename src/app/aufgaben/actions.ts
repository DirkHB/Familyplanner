"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { personForEmail, type Person } from "@/lib/auth/allowlist";
import { createTodo, toggleTodo, deleteTodo } from "@/lib/todos/repository";

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

  await createTodo({
    title,
    notes: String(fd.get("notes") ?? ""),
    dueDate,
    assignee,
    createdBy: me,
    remindAt: remind,
    listId: String(fd.get("listId") ?? "") || null,
  });
  revalidatePath("/aufgaben");
  return { error: null };
}

export async function toggleTodoAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  await toggleTodo(id);
  revalidatePath("/aufgaben");
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
