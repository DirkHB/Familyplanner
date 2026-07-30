import "server-only";
import ICAL from "ical.js";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto/envelope";
import { createICloudClient } from "./tsdav-client";
import { EtagConflictError } from "./caldav";
import { invalidateKalender } from "./range-data";

/**
 * App→iCloud: Titel/Zeit eines Einzeltermins ändern (PUT mit If-Match).
 * Serien bewusst ausgenommen (v1) — zu viele Kanten (Ausnahmen, RRULE-Versatz).
 * Das bestehende VEVENT wird nur punktuell geändert, alle übrigen Properties
 * (Alarme, Attendees, …) bleiben erhalten.
 */

export type UpdateEventInput = { title: string; start?: Date; end?: Date };
export type UpdateEventResult = { updated: boolean; reason?: string };

export async function updateEvent(
  userId: string,
  uid: string,
  input: UpdateEventInput,
): Promise<UpdateEventResult> {
  const master = await prisma.event.findFirst({
    where: { uid, recurrenceId: "" },
    include: { calendar: { include: { account: true } } },
  });
  if (!master) return { updated: false, reason: "Termin nicht gefunden." };
  if (master.rrule) return { updated: false, reason: "Serientermine bitte in Apple Kalender ändern." };

  const account = master.calendar.account;
  const password = decryptSecret(account.credentialsEncrypted);
  const client = await createICloudClient({ username: account.username ?? "", password });

  let ics: string;
  try {
    const comp = new ICAL.Component(ICAL.parse(master.rawIcs));
    const vevent = comp.getFirstSubcomponent("vevent");
    if (!vevent) return { updated: false, reason: "Kalenderdaten unlesbar." };

    vevent.updatePropertyWithValue("summary", input.title);
    if (!master.allDay && input.start && input.end) {
      const startProp = vevent.getFirstProperty("dtstart");
      const tz = startProp?.getParameter("tzid");
      const s = ICAL.Time.fromJSDate(input.start, true);
      const e = ICAL.Time.fromJSDate(input.end, true);
      // Bestehende TZID beibehalten, Werte als UTC setzen (iCloud normalisiert).
      vevent.updatePropertyWithValue("dtstart", s);
      vevent.updatePropertyWithValue("dtend", e);
      if (tz) {
        vevent.getFirstProperty("dtstart")?.removeParameter("tzid");
        vevent.getFirstProperty("dtend")?.removeParameter("tzid");
      }
    }
    const seq = Number(vevent.getFirstPropertyValue("sequence") ?? 0);
    vevent.updatePropertyWithValue("sequence", seq + 1);
    vevent.updatePropertyWithValue("dtstamp", ICAL.Time.fromJSDate(new Date(), true));
    ics = comp.toString();
  } catch {
    return { updated: false, reason: "Kalenderdaten konnten nicht geändert werden." };
  }

  try {
    const put = await client.putEvent(master.calendar.url, master.href, ics, master.etag);
    await prisma.event.update({
      where: { id: master.id },
      data: {
        title: input.title,
        start: !master.allDay && input.start ? input.start : master.start,
        end: !master.allDay && input.end ? input.end : master.end,
        rawIcs: ics,
        etag: put.etag,
        lastSyncedAt: new Date(),
      },
    });
  } catch (err) {
    if (err instanceof EtagConflictError) {
      return { updated: false, reason: "Der Termin wurde gerade anderweitig geändert — kurz warten, der Sync holt den Stand." };
    }
    return { updated: false, reason: "Ändern in iCloud fehlgeschlagen." };
  }

  await prisma.activityLog.create({
    data: { entityType: "event", entityId: uid, action: "updated", actor: userId, detail: { title: input.title } },
  });
  invalidateKalender();
  return { updated: true };
}
