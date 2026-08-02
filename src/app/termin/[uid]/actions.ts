"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { displayNameForEmail } from "@/lib/auth/allowlist";
import { redirect } from "next/navigation";
import { takeCare, requestCare, dismissCare } from "@/lib/care/repository";
import { dismissTitle } from "@/lib/care/rules";
import { deleteEvent } from "@/lib/calendar/delete";
import { updateEvent } from "@/lib/calendar/update";
import { invalidateKalender } from "@/lib/calendar/range-data";
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
  invalidateKalender(); // Notiz-Vorschau in der Woche
  return { ok: true };
}

export async function takeCareAction(uid: string, occurrenceISO: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await takeCare(uid, new Date(occurrenceISO), session.user.id);
  invalidateKalender();
  revalidatePath(`/termin/${encodeURIComponent(uid)}`);
  revalidatePath("/woche");
  return { ok: true };
}

export async function requestCareAction(uid: string, occurrenceISO: string, title: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await requestCare(uid, new Date(occurrenceISO), session.user.id, title);
  invalidateKalender();
  revalidatePath(`/termin/${encodeURIComponent(uid)}`);
  revalidatePath("/woche");
  return { ok: true };
}

/**
 * „Nicht nötig" — nimmt den Termin aus der Betreuungslogik.
 *
 * Merkt sich zusätzlich die Terminart, genau wie im Stapel und im Überblick.
 * Vorher galt der Knopf hier nur für dieses eine Vorkommen — bei einem
 * wöchentlichen Termin kam die Frage deshalb jede Woche wieder. Das war keine
 * Entscheidung, sondern ein Versehen.
 */
export async function dismissCareAction(uid: string, occurrenceISO: string, title: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await dismissCare(uid, new Date(occurrenceISO));
  await dismissTitle(title, session.user.id);
  invalidateKalender();
  revalidatePath(`/termin/${encodeURIComponent(uid)}`);
  revalidatePath("/woche");
  return { ok: true };
}

/** Termin (bzw. Serie) löschen — auch in iCloud. */
export async function deleteEventAction(uid: string): Promise<{ ok: boolean; reason?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, reason: "Nicht angemeldet." };
  const res = await deleteEvent(session.user.id, uid);
  if (!res.deleted) return { ok: false, reason: res.reason };
  invalidateKalender();
  revalidatePath("/woche");
  revalidatePath("/termine");
  redirect("/woche");
}

/** Titel/Zeit ändern — geht zurück nach iCloud. */
export async function updateEventAction(
  uid: string,
  input: { title: string; startISO?: string; endISO?: string },
): Promise<{ ok: boolean; reason?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, reason: "Nicht angemeldet." };
  const title = input.title.trim();
  if (!title) return { ok: false, reason: "Titel fehlt." };
  const res = await updateEvent(session.user.id, uid, {
    title,
    start: input.startISO ? new Date(input.startISO) : undefined,
    end: input.endISO ? new Date(input.endISO) : undefined,
  });
  if (!res.updated) return { ok: false, reason: res.reason };
  revalidatePath(`/termin/${encodeURIComponent(uid)}`);
  revalidatePath("/woche");
  revalidatePath("/termine");
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
