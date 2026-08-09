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

/**
 * Festlegen, in welchen Kalender die App für mich schreibt.
 *
 * Ohne diese Wahl nimmt sie den erstbesten — und wer selbst kein Konto
 * verbunden hat, schreibt damit in den Kalender des anderen. Genau das soll
 * hier aufhören.
 */
export async function setSchreibKalenderAction(calendarId: string | null) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const { prisma } = await import("@/lib/prisma");
  await prisma.user.update({
    where: { id: session.user.id },
    data: { schreibKalenderId: calendarId },
  });
  revalidatePath("/einstellungen");
  return { ok: true };
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
/**
 * Einzelne Mitteilungsarten an- und abschalten.
 *
 * Bewusst nur die beiden, die wirklich etwas auslösen — ein Schalter, der
 * nichts bewirkt, ist schlimmer als keiner. Die Ruhezeiten gelten davon
 * unabhängig weiter.
 */
export type PushArt = "requests" | "taskWindow";

export async function setPushPrefAction(art: PushArt, an: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  if (art !== "requests" && art !== "taskWindow") return { ok: false };

  const { prisma } = await import("@/lib/prisma");
  const { mergePrefs } = await import("@/lib/push/quiet-hours");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { notificationPrefs: true },
  });
  if (!user) return { ok: false };

  // Über die zusammengeführten Vorgaben schreiben, damit eine alte Zeile ohne
  // den Schlüssel nicht plötzlich alles andere verliert.
  await prisma.user.update({
    where: { id: session.user.id },
    data: { notificationPrefs: { ...mergePrefs(user.notificationPrefs), [art]: an } },
  });
  revalidatePath("/einstellungen");
  return { ok: true };
}

/**
 * Wer wohnt hier, und wie heißt das Kind?
 *
 * Bisher stand beides im Code. Ein zweiter Haushalt hätte damit unsere Namen
 * getragen — in der Oberfläche, im Kalendereintrag und in jedem KI-Text.
 */
export async function setHaushaltNamenAction(input: {
  kind: string;
  namen: { email: string; name: string }[];
}): Promise<{ ok: boolean; grund?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, grund: "Nicht angemeldet." };

  const { prisma } = await import("@/lib/prisma");
  const { parseAllowlist } = await import("@/lib/auth/allowlist");
  const { setKindName, invalidateProfil } = await import("@/lib/haushalt/profil");
  const { platzNachReihenfolge } = await import("@/lib/haushalt/platz");

  // Nur Adressen, die ohnehin Zugang haben — von außen lässt sich hier
  // niemand hineinschreiben.
  const reihenfolge = parseAllowlist(process.env.ALLOWED_EMAILS);
  const erlaubt = new Set(reihenfolge);
  for (const n of input.namen) {
    const email = n.email.trim().toLowerCase();
    const name = n.name.trim();
    if (!erlaubt.has(email) || !name) continue;
    /*
     * Hier wird der Platz festgeschrieben — der einzige Moment, in dem ein
     * Haushalt ihn wirklich festlegt. Danach steht er in der Datenbank und
     * überlebt jedes Umsortieren von ALLOWED_EMAILS. Ohne das hinge die
     * Zuordnung an einer Umgebungsvariablen, und wer sie umstellt, tauscht
     * rückwirkend alle Aufgaben zwischen zwei Menschen.
     */
    const platz = platzNachReihenfolge(reihenfolge.indexOf(email));
    const vorhanden = await prisma.user.findUnique({ where: { email } });
    await prisma.user.upsert({
      where: { email },
      create: { email, name, slot: platz },
      // Ein einmal vergebener Platz bleibt; nur der Name wird aktualisiert.
      update: { name, ...(vorhanden?.slot ? {} : { slot: platz }) },
    });
  }
  await setKindName(input.kind);
  invalidateProfil();
  revalidatePath("/einstellungen");
  revalidatePath("/woche");
  return { ok: true };
}

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
  const { meinPlatz } = await import("@/lib/haushalt/profil");
  const { importRemindersList } = await import("@/lib/todos/import-icloud");
  const res = await importRemindersList(url, await meinPlatz(session.user.email));
  revalidatePath("/einstellungen");
  revalidatePath("/aufgaben");
  return res;
}

/**
 * Eine eingefügte Liste als Aufgabenliste übernehmen — der Weg, der immer
 * geht. Apple gibt modernisierte Erinnerungslisten über CalDAV nicht mehr
 * heraus; kopieren und einfügen hängt an nichts außer der Zwischenablage.
 * Schon vorhandene offene Aufgaben gleichen Titels werden übersprungen,
 * damit doppeltes Einfügen nichts verdoppelt.
 */
export async function importPastedListAction(name: string, text: string) {
  const session = await auth();
  if (!session?.user?.email) {
    return { ok: false as const, grund: "Nicht angemeldet.", uebernommen: 0, uebersprungen: 0 };
  }
  const { parsePastedTasks } = await import("@/lib/todos/paste");
  const titel = parsePastedTasks(text);
  if (titel.length === 0) {
    return { ok: false as const, grund: "Keine Aufgaben im eingefügten Text gefunden.", uebernommen: 0, uebersprungen: 0 };
  }

  const { createTodoList } = await import("@/lib/todos/lists");
  const liste = await createTodoList(name);
  if (!liste.ok || !liste.id) {
    return { ok: false as const, grund: liste.grund ?? "Liste konnte nicht angelegt werden.", uebernommen: 0, uebersprungen: 0 };
  }

  const { prisma } = await import("@/lib/prisma");
  const { meinPlatz } = await import("@/lib/haushalt/profil");
  const vorhandene = await prisma.todo.findMany({
    where: { listId: liste.id, status: "offen" },
    select: { title: true },
  });
  const schonDa = new Set(vorhandene.map((t) => t.title.trim().toLowerCase()));

  const me = await meinPlatz(session.user.email);
  let uebernommen = 0;
  for (const t of titel) {
    if (schonDa.has(t.toLowerCase())) continue;
    await prisma.todo.create({ data: { title: t, listId: liste.id, createdBy: me } });
    uebernommen++;
  }

  revalidatePath("/einstellungen");
  revalidatePath("/aufgaben");
  return {
    ok: true as const,
    uebernommen,
    uebersprungen: titel.length - uebernommen,
  };
}

/**
 * Tagesfenster für den Zeitstrahl — je Person. Der Standard (7–21) bleibt
 * gespeichert leer, damit eine spätere Änderung des Standards beide erreicht,
 * die nie etwas verstellt haben.
 */
export async function setTagesfensterAction(von: number, bis: number) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, grund: "Nicht angemeldet." };
  if (!Number.isInteger(von) || !Number.isInteger(bis) || von < 0 || bis > 24 || von >= bis) {
    return { ok: false, grund: "Das Fenster braucht einen Anfang vor dem Ende." };
  }
  const { prisma } = await import("@/lib/prisma");
  await prisma.user.update({
    where: { id: session.user.id },
    data: { tagVonStunde: von, tagBisStunde: bis },
  });
  revalidatePath("/einstellungen");
  revalidatePath("/woche");
  return { ok: true };
}
