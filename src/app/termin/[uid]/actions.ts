"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { displayNameForEmail } from "@/lib/auth/allowlist";
import { takeCare, requestCare } from "@/lib/care/repository";
import { aiConfigured, getAnthropic, AI_MODEL } from "@/lib/ai/client";
import { suggestPrep } from "@/lib/ai/prep-suggest";

export type PrepItem = { text: string; done: boolean };

function readPrep(raw: unknown): PrepItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => {
      const o = (it ?? {}) as Partial<PrepItem>;
      return { text: String(o.text ?? "").trim(), done: !!o.done };
    })
    .filter((it) => it.text);
}

/** Vorbereitungs-Checkliste ist App-Zusatzdaten an der UID — vom Sync unberührt. */
export async function savePrep(uid: string, items: PrepItem[]): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false };
  const clean = readPrep(items).slice(0, 50);
  const by = displayNameForEmail(session.user.email);
  await prisma.eventDetail.upsert({
    where: { eventUid: uid },
    create: { eventUid: uid, prepChecklist: clean, createdBy: by },
    update: { prepChecklist: clean },
  });
  revalidatePath(`/termin/${encodeURIComponent(uid)}`);
  return { ok: true };
}

/** KI-Vorschläge für die Checkliste (nur Vorschau, wird nicht automatisch gespeichert). */
export async function suggestPrepAction(
  title: string,
  category: string,
): Promise<{ ok: true; items: string[] } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Nicht angemeldet." };
  if (!aiConfigured()) return { ok: false, error: "KI ist noch nicht konfiguriert (API-Key fehlt)." };
  try {
    const items = await suggestPrep(getAnthropic(), AI_MODEL, title, category);
    return { ok: true, items };
  } catch {
    return { ok: false, error: "Vorschläge fehlgeschlagen. Versuch es später noch einmal." };
  }
}

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
