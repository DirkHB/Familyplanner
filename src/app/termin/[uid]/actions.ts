"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { displayNameForEmail } from "@/lib/auth/allowlist";
import { takeCare, requestCare } from "@/lib/care/repository";

/** Notizen sind App-Zusatzdaten an der iCalendar-UID — vom Sync unberührt. */
export async function saveNotes(uid: string, notes: string): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false };
  const by = displayNameForEmail(session.user.email);

  await prisma.eventDetail.upsert({
    where: { eventUid: uid },
    create: { eventUid: uid, notes, createdBy: by },
    update: { notes },
  });
  return { ok: true };
}

export async function takeCareAction(uid: string, occurrenceISO: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await takeCare(uid, new Date(occurrenceISO), session.user.id);
  revalidatePath(`/termin/${encodeURIComponent(uid)}`);
  revalidatePath("/woche");
  return { ok: true };
}

export async function requestCareAction(uid: string, occurrenceISO: string, title: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await requestCare(uid, new Date(occurrenceISO), session.user.id, title);
  revalidatePath(`/termin/${encodeURIComponent(uid)}`);
  revalidatePath("/woche");
  return { ok: true };
}
