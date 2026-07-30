import "server-only";
import { prisma } from "@/lib/prisma";
import { parseAllowlist, personForEmail, displayNameForEmail, type Person } from "@/lib/auth/allowlist";
import { mergePrefs, isQuietHours } from "@/lib/push/quiet-hours";
import { sendPushToUser } from "@/lib/push/webpush";

/** Gemeinsame Aufgaben (To-Dos) mit ETA, Verantwortlichen und Erinnerungen. */

export async function listTodos() {
  return prisma.todo.findMany({
    orderBy: [{ status: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 200,
  });
}

export async function createTodo(input: {
  title: string;
  notes?: string;
  dueDate?: Date | null;
  assignee?: Person | null;
  createdBy: Person;
  remindAt?: Date | null;
}) {
  const todo = await prisma.todo.create({
    data: {
      title: input.title.trim(),
      notes: input.notes?.trim() || null,
      dueDate: input.dueDate ?? null,
      assignee: input.assignee ?? null,
      createdBy: input.createdBy,
      remindAt: input.remindAt ?? null,
    },
  });

  // Dem anderen zugewiesen → sofort freundlich Bescheid geben (best effort).
  if (input.assignee && input.assignee !== input.createdBy) {
    void notifyPerson(input.assignee, {
      title: `${displayNameForPerson(input.createdBy)} hat dir eine Aufgabe eingetragen`,
      body: todo.title,
      url: "/aufgaben",
      tag: `todo-${todo.id}`,
    });
  }
  return todo;
}

export async function toggleTodo(id: string) {
  const t = await prisma.todo.findUnique({ where: { id } });
  if (!t) return;
  const done = t.status === "erledigt";
  await prisma.todo.update({
    where: { id },
    data: { status: done ? "offen" : "erledigt", completedAt: done ? null : new Date() },
  });
}

export async function deleteTodo(id: string) {
  await prisma.todo.delete({ where: { id } }).catch(() => null);
}

/* ------------------------- Erinnerungen (Worker-Tick) ------------------------- */

function displayNameForPerson(p: Person): string {
  return p === "constanze" ? "Constanze" : "Dirk";
}

/** User-Zeile zu einer Person auflösen (über die Allowlist), inkl. Anlegen falls nötig. */
async function userForPerson(person: Person) {
  const email = parseAllowlist(process.env.ALLOWED_EMAILS).find((e) => personForEmail(e) === person);
  if (!email) return null;
  return prisma.user.upsert({
    where: { email },
    create: { email, name: displayNameForEmail(email) },
    update: {},
  });
}

async function notifyPerson(person: Person, payload: { title: string; body: string; url: string; tag: string }) {
  const user = await userForPerson(person);
  if (!user) return 0;
  const prefs = mergePrefs(user.notificationPrefs);
  if (isQuietHours(new Date(), prefs.quietStart, prefs.quietEnd)) return 0;
  return sendPushToUser(user.id, payload);
}

/**
 * Fällige Erinnerungen verschicken (alle 5 Min vom Worker angestoßen).
 * Jede Erinnerung feuert genau einmal (remindedAt). Ruhezeiten: der Versand
 * wird verschoben, nicht verworfen — remindedAt bleibt leer bis gesendet.
 */
export async function runTodoReminders(now: Date = new Date()): Promise<{ sent: number; considered: number }> {
  const due = await prisma.todo.findMany({
    where: { status: "offen", remindAt: { lte: now }, remindedAt: null },
    take: 50,
  });

  let sent = 0;
  for (const t of due) {
    const person = (t.assignee ?? t.createdBy) as Person | null;
    if (!person) continue;
    const n = await notifyPerson(person, {
      title: "Erinnerung",
      body: t.title,
      url: "/aufgaben",
      tag: `todo-remind-${t.id}`,
    });
    if (n > 0) {
      sent++;
      await prisma.todo.update({ where: { id: t.id }, data: { remindedAt: now } });
    }
  }
  return { sent, considered: due.length };
}
