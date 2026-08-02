import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto/envelope";
import { createICloudClient } from "@/lib/calendar/tsdav-client";
import { buildIcs } from "@/lib/calendar/ics-builder";
import { expandOccurrences } from "@/lib/calendar/ical";
import { invalidateKalender } from "@/lib/calendar/range-data";
import { dayKey } from "@/lib/calendar/format";
import { personForEmail, type Person } from "@/lib/auth/allowlist";
import { getFlag, CARE_BLOCKS } from "@/lib/settings/store";
import {
  CARE_MARKER,
  careBlockTitle,
  careBlockUid,
  careBlockDescription,
  dayKeyFromCareBlockUid,
} from "./block";

/**
 * Betreuungsblöcke in iCloud anlegen und wieder entfernen.
 *
 * Best effort in beide Richtungen: Scheitert der Kalender, bleibt die Zusage
 * in der App trotzdem bestehen. Eine Betreuung darf nie daran hängen, dass
 * iCloud gerade erreichbar ist.
 */

type Ziel = { calendarId: string; calendarUrl: string; username: string; password: string };

async function schreibziel(): Promise<Ziel | null> {
  const account = await prisma.calendarAccount.findFirst({
    where: { provider: "icloud" },
    include: { calendars: { where: { isSynced: true }, orderBy: { name: "asc" } } },
  });
  const calendar = account?.calendars[0];
  if (!account || !calendar) return null;
  return {
    calendarId: calendar.id,
    calendarUrl: calendar.url,
    username: account.username ?? "",
    password: decryptSecret(account.credentialsEncrypted),
  };
}

/** Zeitfenster des Vorkommens, aus dem der Block entsteht. */
async function fenster(eventUid: string, occurrenceDate: Date) {
  const master = await prisma.event.findFirst({
    where: { uid: eventUid, recurrenceId: "" },
    select: { rawIcs: true, title: true },
  });
  if (!master) return null;
  const tag = dayKey(occurrenceDate);
  try {
    const von = new Date(occurrenceDate.getTime() - 2 * 86_400_000);
    const bis = new Date(occurrenceDate.getTime() + 2 * 86_400_000);
    const occ = expandOccurrences(master.rawIcs, von, bis).find((o) => dayKey(o.start) === tag);
    if (!occ || occ.allDay) return null; // Ganztägiges ist keine Betreuungszeit
    return { start: occ.start, end: occ.end, anlass: occ.summary || master.title, tag };
  } catch {
    return null;
  }
}

/**
 * Block anlegen oder aktualisieren. Die UID ergibt sich aus Anlass und Tag —
 * ein zweiter Aufruf überschreibt denselben Eintrag, statt einen weiteren
 * anzulegen.
 */
export async function upsertCareBlock(
  eventUid: string,
  occurrenceDate: Date,
  userId: string,
): Promise<void> {
  if (!(await getFlag(CARE_BLOCKS))) return;

  const [ziel, w, user] = await Promise.all([
    schreibziel(),
    fenster(eventUid, occurrenceDate),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);
  if (!ziel || !w || !user) return;

  const person: Person = personForEmail(user.email);
  const uid = careBlockUid(eventUid, w.tag);
  const ics = buildIcs({
    uid,
    title: careBlockTitle(person),
    start: w.start,
    end: w.end,
    allDay: false,
    description: careBlockDescription(w.anlass),
    xProps: { [CARE_MARKER]: person },
  });
  const href = ziel.calendarUrl.replace(/\/$/, "") + "/" + uid + ".ics";

  try {
    const client = await createICloudClient({ username: ziel.username, password: ziel.password });
    const vorhanden = await prisma.event.findFirst({ where: { uid }, select: { etag: true } });
    const put = await client.putEvent(ziel.calendarUrl, href, ics, vorhanden?.etag ?? null);

    await prisma.event.upsert({
      where: { calendarId_uid_recurrenceId: { calendarId: ziel.calendarId, uid, recurrenceId: "" } },
      create: {
        calendarId: ziel.calendarId,
        uid,
        recurrenceId: "",
        href,
        etag: put.etag,
        title: careBlockTitle(person),
        start: w.start,
        end: w.end,
        allDay: false,
        rawIcs: ics,
        lastSyncedAt: new Date(),
      },
      update: {
        title: careBlockTitle(person),
        start: w.start,
        end: w.end,
        rawIcs: ics,
        etag: put.etag,
        lastSyncedAt: new Date(),
      },
    });
    invalidateKalender();
  } catch {
    /* Kalender nicht erreichbar — die Zusage in der App bleibt gültig. */
  }
}

/**
 * Zu welchem Anlass gehört dieser Block?
 *
 * Aus der UID lässt sich nur der Tag zurücklesen. Also: die Betreuungen dieses
 * Tages holen und für jede prüfen, ob ihre gebaute UID die gesuchte ist. Das
 * kommt ohne zusätzliche Spalte aus und funktioniert auch für Blöcke, die
 * schon im Kalender stehen.
 */
export async function anlassFuerBlock(
  blockUid: string,
): Promise<{ eventUid: string; occurrenceDate: Date; title: string } | null> {
  const tag = dayKeyFromCareBlockUid(blockUid);
  if (!tag) return null;

  // Mittags-Anker: Der Tagesschlüssel ist Berliner Ortszeit, gespeichert wird
  // UTC-Mitternacht. Über die Mitte des Tages zu greifen, hält beides in der
  // Sommerzeit zusammen.
  const mittag = new Date(`${tag}T12:00:00Z`);
  const von = new Date(mittag.getTime() - 86_400_000);
  const bis = new Date(mittag.getTime() + 86_400_000);

  const kandidaten = await prisma.careAssignment.findMany({
    where: { occurrenceDate: { gte: von, lte: bis } },
    select: { eventUid: true, occurrenceDate: true },
  });
  const treffer = kandidaten.find((k) => careBlockUid(k.eventUid, tag) === blockUid);
  if (!treffer) return null;

  const ev = await prisma.event.findFirst({
    where: { uid: treffer.eventUid, recurrenceId: "" },
    select: { title: true },
  });
  return {
    eventUid: treffer.eventUid,
    occurrenceDate: treffer.occurrenceDate,
    title: ev?.title ?? "diesem Termin",
  };
}

/** Block entfernen, wenn die Betreuung zurückgenommen wird. */
export async function removeCareBlock(eventUid: string, occurrenceDate: Date): Promise<void> {
  return removeCareBlockByUid(careBlockUid(eventUid, dayKey(occurrenceDate)));
}

/** Dasselbe, wenn man den Block schon in der Hand hat statt seinen Anlass. */
export async function removeCareBlockByUid(uid: string): Promise<void> {
  const row = await prisma.event.findFirst({
    where: { uid },
    include: { calendar: { include: { account: true } } },
  });
  if (!row) return;

  try {
    const password = decryptSecret(row.calendar.account.credentialsEncrypted);
    const client = await createICloudClient({
      username: row.calendar.account.username ?? "",
      password,
    });
    await client.deleteEvent(row.href, row.etag ?? "");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // 404 = in iCloud längst weg; alles andere lassen wir lokal trotzdem sauber.
    if (!/404/.test(msg)) {
      /* nichts weiter — lokal aufräumen ist wichtiger als die Fehlermeldung */
    }
  }
  await prisma.event.deleteMany({ where: { uid } });
  invalidateKalender();
}
