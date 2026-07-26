import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto/envelope";
import { createICloudClient } from "./tsdav-client";
import { buildIcs } from "./ics-builder";
import { requestCare } from "@/lib/care/repository";

/** App→iCloud: neuen Termin per PUT anlegen und lokal spiegeln. */

export type CreateEventInput = {
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string | null;
  description?: string | null;
  category?: string;
  checklist?: string[];
  careNeeded?: boolean;
  createdBy?: string;
};

export type CreateEventResult = { created: boolean; uid?: string; reason?: string };

export async function createEvent(
  userId: string,
  input: CreateEventInput,
): Promise<CreateEventResult> {
  const account = await prisma.calendarAccount.findFirst({
    where: { userId, provider: "icloud" },
    include: { calendars: { where: { isSynced: true }, orderBy: { name: "asc" } } },
  });
  if (!account) return { created: false, reason: "Kein iCloud-Konto verbunden." };
  const calendar = account.calendars[0];
  if (!calendar) return { created: false, reason: "Kein synchronisierter Kalender." };

  const password = decryptSecret(account.credentialsEncrypted);
  const client = await createICloudClient({ username: account.username ?? "", password });

  const uid = `fp-${randomUUID()}@planyourweek.app`;
  const ics = buildIcs({
    uid,
    title: input.title,
    start: input.start,
    end: input.end,
    allDay: input.allDay,
    location: input.location ?? null,
    description: input.description ?? null,
  });
  const href = calendar.url.replace(/\/$/, "") + "/" + uid + ".ics";

  const put = await client.putEvent(calendar.url, href, ics, null);

  await prisma.event.create({
    data: {
      calendarId: calendar.id,
      uid,
      recurrenceId: "",
      href,
      etag: put.etag,
      title: input.title,
      start: input.start,
      end: input.end,
      allDay: input.allDay,
      location: input.location ?? null,
      rrule: null,
      rawIcs: ics,
      lastSyncedAt: new Date(),
    },
  });

  if (input.category || (input.checklist && input.checklist.length)) {
    const prep = (input.checklist ?? []).map((text) => ({ text, done: false }));
    await prisma.eventDetail.upsert({
      where: { eventUid: uid },
      create: {
        eventUid: uid,
        category: input.category ?? "sonstiges",
        prepChecklist: prep,
        createdBy: input.createdBy ?? null,
      },
      update: { category: input.category ?? "sonstiges", prepChecklist: prep },
    });
  }

  if (input.careNeeded && !input.allDay) {
    await requestCare(uid, input.start, userId, input.title);
  }

  return { created: true, uid };
}
