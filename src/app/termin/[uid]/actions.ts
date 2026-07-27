"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { displayNameForEmail } from "@/lib/auth/allowlist";
import { takeCare, requestCare } from "@/lib/care/repository";
import { aiConfigured, getAnthropic, AI_MODEL } from "@/lib/ai/client";
import { suggestPrep } from "@/lib/ai/prep-suggest";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { personForEmail } from "@/lib/auth/allowlist";
import {
  linkItemToEvent,
  unlinkItem,
  addItemToEvent,
  toggleItem,
} from "@/lib/shopping/repository";

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
  const rl = rateLimit(`prep:${session.user.id}`, LIMITS.aiPrep.limit, LIMITS.aiPrep.windowMs);
  if (!rl.ok) return { ok: false, error: "Zu viele Anfragen. Versuch es in einer Weile noch einmal." };
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

/* --------------------- Terminbezogener Einkauf (Abschnitt 6.3) --------------------- */

function revalTermin(uid: string) {
  revalidatePath(`/termin/${encodeURIComponent(uid)}`);
  revalidatePath("/einkauf");
}

/** Ein offenes Item der Hauptliste diesem Termin zuordnen. */
export async function linkShoppingItemAction(uid: string, itemId: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await linkItemToEvent(itemId, uid);
  revalTermin(uid);
  return { ok: true };
}

export async function unlinkShoppingItemAction(uid: string, itemId: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await unlinkItem(itemId);
  revalTermin(uid);
  return { ok: true };
}

/** Neues Item direkt für diesen Termin anlegen (bleibt Teil der Hauptliste). */
export async function addShoppingItemToEventAction(uid: string, text: string) {
  const session = await auth();
  if (!session?.user?.email) return { ok: false };
  const t = text.trim();
  if (!t) return { ok: false };
  await addItemToEvent(t, uid, personForEmail(session.user.email));
  revalTermin(uid);
  return { ok: true };
}

/** Item abhaken (wirkt auch in der Hauptliste — es ist dasselbe Item). */
export async function toggleShoppingItemAction(uid: string, itemId: string) {
  const session = await auth();
  if (!session?.user?.email) return { ok: false };
  await toggleItem(itemId, personForEmail(session.user.email));
  revalTermin(uid);
  return { ok: true };
}
