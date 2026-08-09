import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createICloudClient } from "./tsdav-client";
import { kalenderzugang, kalenderzugangFuerPlatz } from "@/lib/haushalt/singletons";
import { buildIcs } from "./ics-builder";
import { requestCare } from "@/lib/care/repository";
import { invalidateKalender } from "./range-data";

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
  /**
   * In wessen Kalender der Termin gehört. Ohne Angabe: in den der anlegenden
   * Person. Das ist der „Kalender von"-Schalter — man legt oft etwas an, das
   * beim anderen im Kalender stehen muss (der Zahnarzttermin, den man für ihn
   * ausgemacht hat).
   */
  fuerPlatz?: string | null;
};

export type CreateEventResult = { created: boolean; uid?: string; reason?: string };

export async function createEvent(
  userId: string,
  input: CreateEventInput,
): Promise<CreateEventResult> {
  // Der Kalender der gewählten Person, sonst der eigene.
  const ziel = input.fuerPlatz
    ? ((await kalenderzugangFuerPlatz(input.fuerPlatz)) ?? (await kalenderzugang(userId)))
    : await kalenderzugang(userId);
  if (!ziel) return { created: false, reason: "Kein iCloud-Kalender verbunden." };

  const client = await createICloudClient({ username: ziel.username, password: ziel.password });

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
  const href = ziel.calendarUrl.replace(/\/$/, "") + "/" + uid + ".ics";

  const put = await client.putEvent(ziel.calendarUrl, href, ics, null);

  await prisma.event.create({
    data: {
      calendarId: ziel.calendarId,
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

  invalidateKalender();
  return { created: true, uid };
}
