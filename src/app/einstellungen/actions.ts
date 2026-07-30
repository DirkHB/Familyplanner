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
