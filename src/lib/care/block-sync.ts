import "server-only";
import { prisma } from "@/lib/prisma";
import { kalenderzugang } from "@/lib/haushalt/singletons";
import { decryptSecret } from "@/lib/crypto/envelope";
import { createICloudClient } from "@/lib/calendar/tsdav-client";
import { buildIcs, ohneZeitstempel } from "@/lib/calendar/ics-builder";
import { expandOccurrences } from "@/lib/calendar/ical";
import { invalidateKalender } from "@/lib/calendar/range-data";
import { dayKey } from "@/lib/calendar/format";
import type { Platz } from "@/lib/haushalt/platz";
import { haushaltProfil, nameFuerSlot } from "@/lib/haushalt/profil";
import { getFlag, CARE_BLOCKS } from "@/lib/settings/store";
import {
  CARE_MARKER,
  CARE_UID_PREFIX,
  careBlockTitle,
  careBlockGruppenUid,
  careBlockGruppenDescription,
  fasseZusammen,
  nameFuerPlatz,
  dayKeyFromCareBlockUid,
  type Betreuungsfenster,
} from "./block";

/**
 * Betreuungsblöcke in iCloud — ein Tag als Ganzes.
 *
 * Früher pflegte die App jeden Block einzeln: eine Betreuung, ein Block. Das
 * war einfach zu schreiben und im Kalender falsch. Zwei Termine um 11:35
 * ergaben zweimal „👶 Nicolas · Constanze" untereinander, obwohl es eine
 * einzige Zusage ist — Constanze ist von 11:35 bis 12:35 da, egal aus wie
 * vielen Gründen.
 *
 * Jetzt wird bei jeder Änderung der ganze Tag neu gerechnet: alle Betreuungen
 * dieses Tages holen, je Person die überlappenden zusammenfassen, und den
 * Kalender auf genau diesen Stand bringen. Was übrig ist, fliegt raus.
 *
 * Das ist mehr Arbeit pro Änderung und dafür selbstheilend. Ein Block, der aus
 * irgendeinem Grund falsch im Kalender steht — falscher Name, doppelt, längst
 * gegenstandslos —, verschwindet beim nächsten Durchlauf von selbst. Genau
 * deshalb ist „Blöcke neu schreiben" nur noch derselbe Aufruf für mehrere Tage.
 *
 * Best effort gegenüber iCloud: Scheitert der Kalender, bleibt die Zusage in
 * der App bestehen. Eine Betreuung darf nie daran hängen, dass iCloud gerade
 * erreichbar ist.
 */

/** Diese Zustände bedeuten „jemand ist da" und gehören damit in den Kalender. */
const IM_KALENDER = ["geklaert", "zugesagt", "extern"];

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

/** Tagesanker in UTC — so liegen Betreuungen und Blöcke auf demselben Datum. */
function tagesAnker(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

type Gewuenscht = {
  uid: string;
  titel: string;
  start: Date;
  end: Date;
  anlaesse: string[];
  person: string;
  eventUids: string[];
  userId: string | null;
};

/**
 * Was sollte an diesem Tag im Kalender stehen?
 *
 * Reine Rechnung aus dem Stand der Datenbank — ohne Netz, ohne Schreiben.
 * Erst danach wird verglichen, was tatsächlich dort steht.
 */
async function sollStand(tag: string, anker: Date): Promise<Gewuenscht[]> {
  const zeilen = await prisma.careAssignment.findMany({
    where: { occurrenceDate: anker, status: { in: IM_KALENDER } },
    include: { responsible: { select: { id: true, slot: true } } },
  });
  if (zeilen.length === 0) return [];

  const profil = await haushaltProfil();

  // Nach Person bündeln: „extern" trägt den eingetragenen Namen mit, damit Oma
  // und der Babysitter nicht in einem Block zusammenfallen.
  const gruppen = new Map<
    string,
    { name: string; userId: string | null; fenster: Betreuungsfenster[] }
  >();

  for (const z of zeilen) {
    const w = await fenster(z.eventUid, z.occurrenceDate);
    if (!w) continue;

    const slot = (z.responsible?.slot as Platz | null) ?? null;
    const externName = z.status === "extern" ? (z.note?.trim() || null) : null;
    const schluessel = slot ?? `extern:${externName ?? ""}`;
    const name = slot
      ? nameFuerSlot(profil, slot)
      : externName || nameFuerPlatz("extern");

    const g = gruppen.get(schluessel) ?? {
      name,
      userId: z.responsible?.id ?? null,
      fenster: [],
    };
    g.fenster.push({ eventUid: z.eventUid, anlass: w.anlass, start: w.start, end: w.end });
    gruppen.set(schluessel, g);
  }

  const soll: Gewuenscht[] = [];
  // Feste Reihenfolge der Personen: Sonst wandern die Nummern in den UIDs von
  // Lauf zu Lauf und die App schreibt Blöcke um, an denen sich nichts ändert.
  for (const schluessel of [...gruppen.keys()].sort()) {
    const g = gruppen.get(schluessel)!;
    fasseZusammen(g.fenster).forEach((gruppe, i) => {
      soll.push({
        uid: careBlockGruppenUid(tag, schluessel, i),
        titel: careBlockTitle(profil.kind, g.name),
        start: gruppe.start,
        end: gruppe.end,
        anlaesse: gruppe.anlaesse,
        person: schluessel.startsWith("extern") ? "extern" : schluessel,
        eventUids: gruppe.eventUids,
        userId: g.userId,
      });
    });
  }
  return soll;
}

/**
 * Den Kalender für einen Tag auf den Stand der App bringen.
 *
 * Rechnet den Soll-Stand, vergleicht ihn mit dem, was da ist, und gleicht die
 * Unterschiede an. Alles hier ist auf Wiederholbarkeit ausgelegt: Zweimal
 * hintereinander aufgerufen passiert beim zweiten Mal nichts mehr.
 */
export async function synchronisiereTag(occurrenceDate: Date): Promise<void> {
  const anker = tagesAnker(occurrenceDate);
  const tag = dayKey(anker);

  // Sind die Blöcke abgeschaltet, ist der Soll-Stand leer — dann räumt derselbe
  // Weg auf, statt dass alte Einträge für immer stehen bleiben. Lässt sich der
  // Schalter nicht lesen, wird gar nichts angefasst: Im Zweifel nicht löschen.
  let an: boolean;
  try {
    an = await getFlag(CARE_BLOCKS);
  } catch {
    return;
  }

  const soll = an ? await sollStand(tag, anker) : [];
  const sollUids = new Set(soll.map((s) => s.uid));

  // Alles, was für diesen Tag im Kalender steht — auch Blöcke aus der alten
  // Zeit, als die UID am einzelnen Termin hing. Die räumt dieser Lauf gleich
  // mit weg.
  const vorhanden = await prisma.event.findMany({
    where: { uid: { startsWith: `${CARE_UID_PREFIX}${tag}-` } },
    select: { uid: true },
  });

  let geaendert = false;
  for (const v of vorhanden) {
    if (sollUids.has(v.uid)) continue;
    await removeCareBlockByUid(v.uid);
    geaendert = true;
  }

  for (const s of soll) {
    if (await schreibeBlock(s)) geaendert = true;
  }

  // Die Zuordnung ausschreiben: Ohne sie fände die Detailansicht nicht mehr,
  // zu welchen Anlässen ein zusammengefasster Block gehört.
  await prisma.careAssignment
    .updateMany({ where: { occurrenceDate: anker }, data: { blockUid: null } })
    .catch(() => null);
  for (const s of soll) {
    await prisma.careAssignment
      .updateMany({
        where: { occurrenceDate: anker, eventUid: { in: s.eventUids } },
        data: { blockUid: s.uid },
      })
      .catch(() => null);
  }

  if (geaendert) await invalidateKalender();
}

/** Einen einzelnen Soll-Block schreiben. `true`, wenn sich etwas geändert hat. */
async function schreibeBlock(s: Gewuenscht): Promise<boolean> {
  const ziel = await kalenderzugang(s.userId);
  if (!ziel) return false;

  const ics = buildIcs({
    uid: s.uid,
    title: s.titel,
    start: s.start,
    end: s.end,
    allDay: false,
    description: careBlockGruppenDescription(s.anlaesse),
    xProps: { [CARE_MARKER]: s.person },
  });

  const vorhanden = await prisma.event.findFirst({
    where: { uid: s.uid },
    select: { etag: true, rawIcs: true, calendarId: true },
  });
  // Unverändert und am richtigen Ort? Dann nichts tun. Das hält die
  // Wiederholbarkeit billig — sonst schriebe jede Änderung an einem Tag alle
  // Blöcke dieses Tages neu nach iCloud.
  if (
    vorhanden &&
    ohneZeitstempel(vorhanden.rawIcs) === ohneZeitstempel(ics) &&
    vorhanden.calendarId === ziel.calendarId
  ) {
    return false;
  }
  // Liegt der Block bisher woanders (die Person hat ihr Schreibziel geändert),
  // muss er dort weg — sonst steht er zweimal da.
  if (vorhanden && vorhanden.calendarId !== ziel.calendarId) {
    await removeCareBlockByUid(s.uid);
  }

  const href = ziel.calendarUrl.replace(/\/$/, "") + "/" + s.uid + ".ics";
  try {
    const client = await createICloudClient({ username: ziel.username, password: ziel.password });
    const jetzt = await prisma.event.findFirst({ where: { uid: s.uid }, select: { etag: true } });
    const put = await client.putEvent(ziel.calendarUrl, href, ics, jetzt?.etag ?? null);

    await prisma.event.upsert({
      where: {
        calendarId_uid_recurrenceId: { calendarId: ziel.calendarId, uid: s.uid, recurrenceId: "" },
      },
      create: {
        calendarId: ziel.calendarId,
        uid: s.uid,
        recurrenceId: "",
        href,
        etag: put.etag,
        title: s.titel,
        start: s.start,
        end: s.end,
        allDay: false,
        rawIcs: ics,
        lastSyncedAt: new Date(),
      },
      update: {
        href,
        title: s.titel,
        start: s.start,
        end: s.end,
        rawIcs: ics,
        etag: put.etag,
        lastSyncedAt: new Date(),
      },
    });
    return true;
  } catch {
    /* Kalender nicht erreichbar — die Zusage in der App bleibt gültig. */
    return false;
  }
}

/**
 * Blöcke über mehrere Tage neu schreiben.
 *
 * Der Reparaturweg: Er rechnet dieselbe Rechnung wie jede einzelne Änderung,
 * nur für einen Zeitraum. Damit lässt sich einsammeln, was aus früheren
 * Fehlern im Kalender steht — falsche Namen, doppelte Einträge, Blöcke ohne
 * Anlass.
 */
export async function schreibeBloeckeNeu(
  von: Date,
  tage: number,
): Promise<{ tage: number }> {
  const start = tagesAnker(von);
  for (let i = 0; i < tage; i++) {
    await synchronisiereTag(new Date(start.getTime() + i * 86_400_000)).catch(() => null);
  }
  return { tage };
}

/**
 * Block anlegen oder aktualisieren.
 *
 * Die Aufrufer kennen weiter nur „hier hat sich eine Betreuung geändert" — was
 * daraus im Kalender folgt, entscheidet der Tageslauf.
 */
export async function upsertCareBlock(
  eventUid: string,
  occurrenceDate: Date,
  _userId: string | null,
  _externName?: string | null,
): Promise<void> {
  await synchronisiereTag(occurrenceDate);
}

/** Block entfernen, wenn die Betreuung zurückgenommen wird. */
export async function removeCareBlock(_eventUid: string, occurrenceDate: Date): Promise<void> {
  await synchronisiereTag(occurrenceDate);
}

/**
 * Zu welchen Anlässen gehört dieser Block?
 *
 * Ein Block kann mehrere überlappende Betreuungen zusammenfassen, deshalb
 * steht die Zuordnung in der Datenbank statt in der UID.
 */
export async function anlassFuerBlock(blockUid: string): Promise<{
  eventUid: string;
  occurrenceDate: Date;
  title: string;
  anlaesse: string[];
  responsibleUserId: string | null;
} | null> {
  const zeilen = await prisma.careAssignment.findMany({
    where: { blockUid },
    orderBy: { eventUid: "asc" },
  });
  if (zeilen.length === 0) return null;

  const events = await prisma.event.findMany({
    where: { uid: { in: zeilen.map((z) => z.eventUid) }, recurrenceId: "" },
    select: { uid: true, title: true },
  });
  const titelFuer = new Map(events.map((e) => [e.uid, e.title]));
  const anlaesse = zeilen.map((z) => titelFuer.get(z.eventUid) ?? "diesem Termin");

  return {
    eventUid: zeilen[0].eventUid,
    occurrenceDate: zeilen[0].occurrenceDate,
    title: anlaesse.join(" und "),
    anlaesse,
    responsibleUserId: zeilen[0].responsibleUserId,
  };
}

/**
 * Alle Blöcke zu einem Anlass entfernen — beim Löschen des Termins.
 *
 * Die betroffenen Tage einmal neu rechnen genügt: Die Betreuungen zu einem
 * gelöschten Termin führen zu keinem Fenster mehr, also fällt ihr Block weg.
 * Was danach noch als verwaister Block dasteht, räumt derselbe Lauf ab.
 */
export async function removeCareBlocksForEvent(eventUid: string): Promise<void> {
  const tage = await prisma.careAssignment.findMany({
    where: { eventUid },
    select: { occurrenceDate: true },
  });
  for (const t of tage) await synchronisiereTag(t.occurrenceDate).catch(() => null);

  // Blöcke, deren Betreuungszeile schon weg ist, hätte niemand mehr gefunden —
  // genau das ist uns einmal passiert und stand danach für immer im Kalender.
  const verwaist = await prisma.event.findMany({
    where: { uid: { startsWith: CARE_UID_PREFIX } },
    select: { uid: true },
  });
  for (const b of verwaist) {
    const tag = dayKeyFromCareBlockUid(b.uid);
    if (!tag) continue;
    const zugehoerig = await prisma.careAssignment.count({ where: { blockUid: b.uid } });
    if (zugehoerig === 0) await removeCareBlockByUid(b.uid).catch(() => null);
  }
}

/** Einen Block wegräumen, wenn man seine UID schon in der Hand hat. */
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
  await prisma.careAssignment.updateMany({ where: { blockUid: uid }, data: { blockUid: null } });
  await invalidateKalender();
}
