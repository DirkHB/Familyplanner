"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  connectICloudAccount,
  setCalendarSynced,
  disconnectICloudAccount,
} from "@/lib/calendar/account";
import { runSyncForAllAccounts } from "@/lib/calendar/sync-engine";

export async function connectAction(
  _prev: { error: string | null } | null,
  formData: FormData,
): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Nicht angemeldet." };
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  if (!username || !password) return { error: "Apple-ID und App-Passwort nötig." };

  try {
    await connectICloudAccount(session.user.id, username, password);
    revalidatePath("/einstellungen");
    return { error: null };
  } catch {
    return {
      error: "Verbindung fehlgeschlagen. Apple-ID und app-spezifisches Passwort prüfen.",
    };
  }
}

export async function toggleCalendarAction(calendarId: string, isSynced: boolean) {
  const session = await auth();
  if (!session?.user?.id) return;
  await setCalendarSynced(calendarId, isSynced);
  revalidatePath("/einstellungen");
  revalidatePath("/woche");
}

export async function syncNowAction(): Promise<{
  ok: boolean;
  upserted: number;
  deleted: number;
  errorCount: number;
}> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, upserted: 0, deleted: 0, errorCount: 0 };
  const summary = await runSyncForAllAccounts();
  revalidatePath("/einstellungen");
  revalidatePath("/woche");
  return {
    ok: true,
    upserted: summary.upserted,
    deleted: summary.deleted,
    errorCount: summary.errors.length,
  };
}

export async function disconnectAction(accountId: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  await disconnectICloudAccount(accountId);
  revalidatePath("/einstellungen");
}

/** Test-Push an das eigene Konto — umgeht bewusst die Ruhezeiten (expliziter Wunsch). */
export async function sendTestPushAction(): Promise<{ devices: number; sent: number; quiet: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { devices: 0, sent: 0, quiet: false };
  const { prisma } = await import("@/lib/prisma");
  const { sendPushToUser } = await import("@/lib/push/webpush");
  const { isQuietHours } = await import("@/lib/push/quiet-hours");
  const devices = await prisma.pushSubscription.count({ where: { userId: session.user.id } });
  const sent = devices
    ? await sendPushToUser(session.user.id, {
        title: "Test ✓",
        body: "Push funktioniert auf diesem Gerät.",
        url: "/einstellungen",
        tag: "test-push",
      })
    : 0;
  return { devices, sent, quiet: isQuietHours(new Date()) };
}

/**
 * Schreibt die App Betreuungsbloecke in den echten iCloud-Kalender?
 * Standard ist aus — das ist die erste Funktion, die selbstaendig Eintraege
 * im gemeinsamen Kalender anlegt.
 */
export async function setCareBlocksAction(an: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const { setFlag, CARE_BLOCKS } = await import("@/lib/settings/store");
  await setFlag(CARE_BLOCKS, an);
  revalidatePath("/einstellungen");
  return { ok: true };
}

/* --------------------------- Aufgabenlisten & Läden --------------------------- */

/**
 * Beides sind Fächer, die Constanze und Dirk selbst anlegen. Die Aktionen
 * geben einen Grund zurück statt zu werfen: Ein Name, den es schon gibt, ist
 * kein Fehler des Programms, sondern etwas, das man lesen können muss.
 */

export async function createTodoListAction(name: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, grund: "Nicht angemeldet." };
  const { createTodoList } = await import("@/lib/todos/lists");
  const res = await createTodoList(name);
  revalidatePath("/einstellungen");
  revalidatePath("/aufgaben");
  return res;
}

export async function renameTodoListAction(id: string, name: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, grund: "Nicht angemeldet." };
  const { renameTodoList } = await import("@/lib/todos/lists");
  const res = await renameTodoList(id, name);
  revalidatePath("/einstellungen");
  revalidatePath("/aufgaben");
  return res;
}

export async function deleteTodoListAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const { deleteTodoList } = await import("@/lib/todos/lists");
  await deleteTodoList(id);
  revalidatePath("/einstellungen");
  revalidatePath("/aufgaben");
  return { ok: true };
}

export async function createStoreAction(name: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, grund: "Nicht angemeldet." };
  const { createStore } = await import("@/lib/shopping/repository");
  const res = await createStore(name);
  revalidatePath("/einstellungen");
  revalidatePath("/einkauf");
  return res;
}

export async function renameStoreAction(id: string, name: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, grund: "Nicht angemeldet." };
  const { renameStore } = await import("@/lib/shopping/repository");
  const res = await renameStore(id, name);
  revalidatePath("/einstellungen");
  revalidatePath("/einkauf");
  return res;
}

export async function deleteStoreAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const { deleteStore } = await import("@/lib/shopping/repository");
  await deleteStore(id);
  revalidatePath("/einstellungen");
  revalidatePath("/einkauf");
  return { ok: true };
}

/* ------------------- Erinnerungen aus iCloud übernehmen ------------------- */

export async function discoverRemindersAction() {
  const session = await auth();
  if (!session?.user?.id) return { listen: [] };
  const { discoverRemindersLists } = await import("@/lib/todos/import-icloud");
  try {
    return { listen: await discoverRemindersLists() };
  } catch {
    return { listen: [] };
  }
}

export async function importRemindersAction(url: string) {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, grund: "Nicht angemeldet.", uebernommen: 0, uebersprungen: 0 };
  const { personForEmail } = await import("@/lib/auth/allowlist");
  const { importRemindersList } = await import("@/lib/todos/import-icloud");
  const res = await importRemindersList(url, personForEmail(session.user.email));
  revalidatePath("/einstellungen");
  revalidatePath("/aufgaben");
  return res;
}
