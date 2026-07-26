"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { displayNameForEmail } from "@/lib/auth/allowlist";

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
