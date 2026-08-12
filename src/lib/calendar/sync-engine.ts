import "server-only";
import { prisma } from "@/lib/prisma";
import { invalidateKalender } from "./range-data";
import { raeumeBetreuungWeg } from "@/lib/care/block-sync";
import { isCareBlockUid } from "@/lib/care/block";
import { decryptSecret } from "@/lib/crypto/envelope";
import { createICloudClient } from "./tsdav-client";
import { createIcsClient } from "./ics-client";
import { liestUeberFeed } from "./provider";
import { parseEvents } from "./ical";
import { diffPull, type LocalState } from "./sync-diff";
import type { CalDavClient, RemoteObject } from "./caldav";

/**
 * Sync-Orchestrierung. Phase 1: robuster PULL (iCloud → App). Push-Primitive existieren
 * im Client für spätere App→iCloud-Änderungen. Ein Fehler kippt nie die ganze App — er
 * wird pro Kalender gespeichert und im Einstellungen-Screen sichtbar (Abnahmekriterium 4).
 */

export type SyncSummary = {
  calendars: number;
  upserted: number;
  deleted: number;
  errors: { calendar: string; message: string }[];
};

/**
 * Der passende Zugang zum Konto.
 *
 * Zwei Arten, und der Unterschied ist grundsätzlich: iCloud ist ein Server,
 * mit dem man spricht — ein Abonnement ist eine Datei, die man herunterlädt.
 * Was verschlüsselt gespeichert ist, ist bei iCloud das Passwort und beim
 * Abonnement die Adresse. Beide sind Geheimnisse: Wer die Adresse hat, sieht
 * den Kalender.
 */
async function clientForAccount(accountId: string): Promise<CalDavClient> {
  const account = await prisma.calendarAccount.findUniqueOrThrow({
    where: { id: accountId },
  });
  const geheimnis = decryptSecret(account.credentialsEncrypted);
  /*
   * Ein Google-Kalender wird genauso gelesen wie ein Abonnement — über seine
   * .ics-Adresse. Der Unterschied liegt allein im Rückweg, und der läuft nicht
   * über diesen Client, sondern über die Kalender-API (siehe schreiber.ts).
   */
  if (liestUeberFeed(account.provider)) {
    return createIcsClient(geheimnis, account.username ?? "Abonnement");
  }
  return createICloudClient({ username: account.username ?? "", password: geheimnis });
}

/** Ein RemoteObject in eine Event-Zeile übersetzen (Kalenderfelder aus dem Master-VEVENT). */
function rowFromObject(calendarId: string, obj: RemoteObject) {
  const parsed = parseEvents(obj.ics);
  const master = parsed.find((e) => !e.isOverride) ?? parsed[0];
  if (!master) return null;
  return {
    calendarId,
    uid: master.uid,
    recurrenceId: "", // ganze Serie in einer Zeile (rawIcs enthält Overrides)
    href: obj.href,
    etag: obj.etag,
    title: master.summary,
    start: master.start,
    end: master.end,
    allDay: master.allDay,
    location: master.location,
    rrule: master.rrule,
    rawIcs: obj.ics,
    lastSyncedAt: new Date(),
  };
}

async function syncCalendar(
  client: CalDavClient,
  calendar: { id: string; url: string; name: string },
  summary: SyncSummary,
) {
  try {
    const changes = await client.fetchChanges(calendar.url);

    const existing = await prisma.event.findMany({
      where: { calendarId: calendar.id },
      select: { href: true, etag: true },
    });
    const local: LocalState = {
      etagByHref: new Map(existing.map((e) => [e.href, e.etag ?? ""])),
    };

    // fetchChanges liefert immer den vollständigen Kalender → Löschungen ableitbar.
    const diff = diffPull(changes.objects, local, true);

    for (const obj of diff.toUpsert) {
      const row = rowFromObject(calendar.id, obj);
      if (!row) continue;
      await prisma.event.upsert({
        where: {
          calendarId_uid_recurrenceId: {
            calendarId: row.calendarId,
            uid: row.uid,
            recurrenceId: "",
          },
        },
        create: row,
        update: row,
      });
      summary.upserted++;
    }

    if (diff.hrefsToDelete.length) {
      /*
       * Wer verschwindet, muss vorher gefragt werden.
       *
       * An einem gelöschten Termin hängt womöglich eine Betreuungsabsprache,
       * und an der ein Eintrag im Kalender („👶 Nicolas · Constanze"). Der
       * verschwindet nicht mit seinem Anlass — er ist ein eigener Termin.
       * Bis eben blieb er einfach stehen: Wer in Apple Kalender etwas löschte,
       * hatte danach einen Betreuungseintrag für einen Termin, den es nicht
       * mehr gab.
       *
       * Die eigenen Blöcke bleiben dabei außen vor. Löscht sie jemand von Hand
       * in Apple Kalender, ist das eine Ansage — die schreiben wir nicht im
       * nächsten Atemzug zurück.
       */
      const verschwunden = await prisma.event.findMany({
        where: { calendarId: calendar.id, href: { in: diff.hrefsToDelete } },
        select: { uid: true },
      });

      const del = await prisma.event.deleteMany({
        where: { calendarId: calendar.id, href: { in: diff.hrefsToDelete } },
      });
      summary.deleted += del.count;

      const anlaesse = [
        ...new Set(verschwunden.map((v) => v.uid).filter((u) => !isCareBlockUid(u))),
      ];
      await raeumeBetreuungWeg(anlaesse).catch(() => null);
    }

    await prisma.calendar.update({
      where: { id: calendar.id },
      data: {
        ctag: changes.ctag,
        syncToken: changes.newSyncToken,
        lastSyncedAt: new Date(),
        lastSyncOk: true,
        lastError: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    summary.errors.push({ calendar: calendar.name, message });
    await prisma.calendar.update({
      where: { id: calendar.id },
      data: { lastSyncedAt: new Date(), lastSyncOk: false, lastError: message },
    });
    await prisma.activityLog.create({
      data: {
        entityType: "calendar",
        entityId: calendar.id,
        action: "sync_error",
        actor: "sync",
        detail: { message },
      },
    });
  }
}

/** Alle verbundenen, zu synchronisierenden Kalender abgleichen. */
export async function runSyncForAllAccounts(): Promise<SyncSummary> {
  const summary: SyncSummary = { calendars: 0, upserted: 0, deleted: 0, errors: [] };
  const accounts = await prisma.calendarAccount.findMany({
    include: { calendars: { where: { isSynced: true } } },
  });

  for (const account of accounts) {
    if (account.calendars.length === 0) continue;
    let client: CalDavClient;
    try {
      client = await clientForAccount(account.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push({ calendar: account.username ?? account.id, message });
      continue;
    }
    for (const cal of account.calendars) {
      summary.calendars++;
      await syncCalendar(client, cal, summary);
    }
  }

  await prisma.activityLog.create({
    data: {
      entityType: "sync",
      entityId: "all",
      action: "sync_run",
      actor: "sync",
      detail: {
        calendars: summary.calendars,
        upserted: summary.upserted,
        deleted: summary.deleted,
        errorCount: summary.errors.length,
      },
    },
  });

  // Frische Daten sofort sichtbar machen (60-s-Ansichts-Cache verwerfen).
  if (summary.upserted > 0 || summary.deleted > 0) await invalidateKalender();

  return summary;
}
