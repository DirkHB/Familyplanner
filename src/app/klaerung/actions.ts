"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toggleTodo } from "@/lib/todos/repository";
import { takeCare, requestCare, dismissCare, getCareForOccurrence } from "@/lib/care/repository";
import { dismissTitle, undismissTitle } from "@/lib/care/rules";
import { answerRequest } from "@/lib/requests/repository";
import { removeCareBlock } from "@/lib/care/block-sync";
import { invalidateKalender } from "@/lib/calendar/range-data";
import { startOfDayBerlin } from "@/lib/calendar/format";
import type { StapelUndo } from "@/lib/klaerung/undo";

/**
 * Aktionen des Klärungs-Stapels — jede Karte ist genau ein Aufruf.
 *
 * Jede Aktion schreibt SOFORT und gibt eine Gegenbuchung (`undo`) zurück.
 * Früher wartete der Client 3 Sekunden, bevor er überhaupt schrieb — wer in
 * der Zeit die App wechselte, verlor die Antwort und bekam dieselbe Frage
 * wieder. Sofort schreiben heißt auch: Woche und Überblick sind schon
 * aktuell, wenn der Stapel zuklappt, weil jede Antwort sie neu rendert.
 */

type Ergebnis = { ok: boolean; undo?: StapelUndo };

function reval() {
  revalidatePath("/woche");
  revalidatePath("/aufgaben");
}

/** Stand der Betreuungsentscheidung vor der Änderung — für die Gegenbuchung. */
async function careVorher(uid: string, occurrenceISO: string) {
  const c = await getCareForOccurrence(uid, new Date(occurrenceISO));
  return c ? { status: c.status, responsibleUserId: c.responsibleUserId } : null;
}

export async function stapelErledigtAction(todoId: string): Promise<Ergebnis> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await toggleTodo(todoId);
  reval();
  return { ok: true, undo: { art: "todo-toggle", todoId } };
}

/** „Auf morgen schieben" — zählt mit, damit ewiges Schieben sichtbar wird. */
export async function stapelMorgenAction(todoId: string): Promise<Ergebnis> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const vorher = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { dueDate: true, shiftCount: true },
  });
  const morgen = new Date(startOfDayBerlin(new Date()).getTime() + 86_400_000 + 9 * 3_600_000);
  await prisma.todo.update({
    where: { id: todoId },
    data: { dueDate: morgen, shiftCount: { increment: 1 } },
  });
  reval();
  return {
    ok: true,
    undo: vorher
      ? {
          art: "todo-stand",
          todoId,
          dueISO: vorher.dueDate?.toISOString() ?? null,
          shiftCount: vorher.shiftCount,
        }
      : undefined,
  };
}

export async function stapelBetreuungIchAction(
  uid: string,
  occurrenceISO: string,
): Promise<Ergebnis> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const vorher = await careVorher(uid, occurrenceISO);
  await takeCare(uid, new Date(occurrenceISO), session.user.id);
  invalidateKalender();
  reval();
  return { ok: true, undo: { art: "care-stand", uid, occurrenceISO, vorher } };
}

/**
 * „Nicht nötig" — Nicolas ist beim Termin dabei (Kinderarzt, Krabbelgruppe),
 * oder die Frage stellt sich hier gar nicht.
 *
 * Merkt sich beides: dieses Vorkommen ist entschieden, und die Terminart wird
 * nie wieder gefragt. Ohne das Zweite müsste man den Schwimmkurs jede Woche
 * neu abwinken — und genau daran stirbt so eine Funktion.
 */
export async function stapelBetreuungUnnoetigAction(
  uid: string,
  occurrenceISO: string,
  title: string,
): Promise<Ergebnis> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const vorher = await careVorher(uid, occurrenceISO);
  await dismissCare(uid, new Date(occurrenceISO));
  await dismissTitle(title, session.user.id);
  invalidateKalender();
  reval();
  return {
    ok: true,
    undo: { art: "care-stand", uid, occurrenceISO, vorher, titelZurueck: title },
  };
}

/** „Ich kann nicht" — fragt automatisch den anderen (bestehende Anfragen-Kette). */
export async function stapelKannNichtAction(
  uid: string,
  occurrenceISO: string,
  title: string,
): Promise<Ergebnis> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const vorher = await careVorher(uid, occurrenceISO);
  const requestId = await requestCare(uid, new Date(occurrenceISO), session.user.id, title);
  invalidateKalender();
  reval();
  return {
    ok: true,
    undo: { art: "care-stand", uid, occurrenceISO, vorher, anfrageWeg: requestId ?? undefined },
  };
}

export async function stapelAntwortAction(
  requestId: string,
  antwort: "Ja" | "Nein",
): Promise<Ergebnis> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const req = await prisma.request.findUnique({
    where: { id: requestId },
    select: { eventUid: true },
  });
  await answerRequest(requestId, session.user.id, antwort);
  invalidateKalender();
  reval();
  return {
    ok: true,
    undo: { art: "antwort-zurueck", requestId, eventUid: req?.eventUid ?? null },
  };
}

/** Eskalation: anderweitig gelöst (Oma, Termin verschoben, …). */
export async function stapelEskalationGeklaertAction(
  uid: string,
  occurrenceISO: string | null,
): Promise<Ergebnis> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const iso = occurrenceISO ?? new Date().toISOString();
  const vorher = await careVorher(uid, iso);
  await dismissCare(uid, new Date(iso));
  invalidateKalender();
  reval();
  return { ok: true, undo: { art: "care-stand", uid, occurrenceISO: iso, vorher } };
}

/** Sonntags-Aufräumen: „Diese Woche" — Faelligkeit auf den kommenden Sonntag. */
export async function stapelParkenDieseWocheAction(todoId: string): Promise<Ergebnis> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const vorher = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { dueDate: true, shiftCount: true },
  });
  const heute = startOfDayBerlin(new Date());
  // Sonntagabend als Zielpunkt: konkret genug fuer einen Plan, weit genug,
  // um die Woche nicht zu verstopfen.
  const sonntag = new Date(heute.getTime() + 7 * 86_400_000 + 18 * 3_600_000);
  await prisma.todo.update({ where: { id: todoId }, data: { dueDate: sonntag } });
  reval();
  return {
    ok: true,
    undo: vorher
      ? {
          art: "todo-stand",
          todoId,
          dueISO: vorher.dueDate?.toISOString() ?? null,
          shiftCount: vorher.shiftCount,
        }
      : undefined,
  };
}

/** „Bleibt liegen" — nichts aendern, nur diese Woche nicht mehr fragen. */
export async function stapelParkenBleibtAction(todoId: string): Promise<Ergebnis> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const vorher = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { dueDate: true, shiftCount: true },
  });
  await prisma.todo.update({ where: { id: todoId }, data: { shiftCount: { increment: 1 } } });
  reval();
  return {
    ok: true,
    undo: vorher
      ? {
          art: "todo-stand",
          todoId,
          dueISO: vorher.dueDate?.toISOString() ?? null,
          shiftCount: vorher.shiftCount,
        }
      : undefined,
  };
}

/**
 * Die Gegenbuchung. Führt genau das zurück, was die Karte geschrieben hat —
 * nicht mehr: Hat Constanze eine Anfrage inzwischen beantwortet, gewinnt
 * ihre Antwort, und die Anfrage wird nicht mehr eingesammelt.
 */
export async function stapelRueckgaengigAction(u: StapelUndo): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };

  switch (u.art) {
    case "todo-toggle":
      await toggleTodo(u.todoId);
      break;

    case "todo-stand":
      await prisma.todo
        .update({
          where: { id: u.todoId },
          data: { dueDate: u.dueISO ? new Date(u.dueISO) : null, shiftCount: u.shiftCount },
        })
        .catch(() => null);
      break;

    case "care-stand": {
      const occurrenceDate = new Date(
        Date.UTC(
          new Date(u.occurrenceISO).getUTCFullYear(),
          new Date(u.occurrenceISO).getUTCMonth(),
          new Date(u.occurrenceISO).getUTCDate(),
        ),
      );
      if (u.anfrageWeg) {
        // Nur einsammeln, solange sie unbeantwortet ist.
        await prisma.request
          .deleteMany({ where: { id: u.anfrageWeg, status: "open" } })
          .catch(() => null);
      }
      if (u.titelZurueck) await undismissTitle(u.titelZurueck);
      if (u.vorher) {
        await prisma.careAssignment.upsert({
          where: { eventUid_occurrenceDate: { eventUid: u.uid, occurrenceDate } },
          create: {
            eventUid: u.uid,
            occurrenceDate,
            status: u.vorher.status,
            responsibleUserId: u.vorher.responsibleUserId,
          },
          update: {
            status: u.vorher.status,
            responsibleUserId: u.vorher.responsibleUserId,
          },
        });
      } else {
        await prisma.careAssignment.deleteMany({
          where: { eventUid: u.uid, occurrenceDate },
        });
      }
      // Der Kalenderblock gehört zur zurückgenommenen Zusage.
      await removeCareBlock(u.uid, occurrenceDate).catch(() => {});
      break;
    }

    case "antwort-zurueck": {
      await prisma.request
        .update({ where: { id: u.requestId }, data: { status: "open", answer: null } })
        .catch(() => null);
      // Hatte das „Ja" die Betreuung geklärt, steht sie wieder offen. Der
      // Push an den anderen ist raus — das lässt sich nicht zurückholen,
      // aber die App zeigt überall wieder den ehrlichen Stand.
      if (u.eventUid) {
        const geklaert = await prisma.careAssignment.findFirst({
          where: { eventUid: u.eventUid, status: "geklaert", responsibleUserId: session.user.id },
          orderBy: { occurrenceDate: "asc" },
        });
        if (geklaert) {
          await prisma.careAssignment.update({
            where: { id: geklaert.id },
            data: { status: "offen", responsibleUserId: null },
          });
          await removeCareBlock(u.eventUid, geklaert.occurrenceDate).catch(() => {});
        }
      }
      break;
    }
  }

  invalidateKalender();
  reval();
  return { ok: true };
}
