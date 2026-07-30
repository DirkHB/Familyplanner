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
