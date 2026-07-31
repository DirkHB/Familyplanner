"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toggleTodo } from "@/lib/todos/repository";
import { takeCare, requestCare, dismissCare } from "@/lib/care/repository";
import { answerRequest } from "@/lib/requests/repository";
import { invalidateKalender } from "@/lib/calendar/range-data";
import { startOfDayBerlin } from "@/lib/calendar/format";

/** Aktionen des Klärungs-Stapels — jede Karte ist genau ein Aufruf. */

function reval() {
  revalidatePath("/woche");
  revalidatePath("/aufgaben");
  revalidatePath("/ueberblick");
}

export async function stapelErledigtAction(todoId: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await toggleTodo(todoId);
  reval();
  return { ok: true };
}

/** „Auf morgen schieben" — zählt mit, damit ewiges Schieben sichtbar wird. */
export async function stapelMorgenAction(todoId: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const morgen = new Date(startOfDayBerlin(new Date()).getTime() + 86_400_000 + 9 * 3_600_000);
  await prisma.todo.update({
    where: { id: todoId },
    data: { dueDate: morgen, shiftCount: { increment: 1 } },
  });
  reval();
  return { ok: true };
}

export async function stapelBetreuungIchAction(uid: string, occurrenceISO: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await takeCare(uid, new Date(occurrenceISO), session.user.id);
  invalidateKalender();
  reval();
  return { ok: true };
}

/** „Ich kann nicht" — fragt automatisch den anderen (bestehende Anfragen-Kette). */
export async function stapelKannNichtAction(uid: string, occurrenceISO: string, title: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await requestCare(uid, new Date(occurrenceISO), session.user.id, title);
  invalidateKalender();
  reval();
  return { ok: true };
}

export async function stapelAntwortAction(requestId: string, antwort: "Ja" | "Nein") {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await answerRequest(requestId, session.user.id, antwort);
  invalidateKalender();
  reval();
  return { ok: true };
}

/** Eskalation: anderweitig gelöst (Oma, Termin verschoben, …). */
export async function stapelEskalationGeklaertAction(uid: string, occurrenceISO: string | null) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await dismissCare(uid, occurrenceISO ? new Date(occurrenceISO) : new Date());
  invalidateKalender();
  reval();
  return { ok: true };
}
