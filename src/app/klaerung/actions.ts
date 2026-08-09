"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toggleTodo } from "@/lib/todos/repository";
import {
  takeCare,
  requestCare,
  dismissCare,
  externCare,
  getCareForOccurrence,
} from "@/lib/care/repository";
import { dismissTitle, undismissTitle } from "@/lib/care/rules";
import { answerRequest, resolvePartner } from "@/lib/requests/repository";
import { meinPlatz } from "@/lib/haushalt/profil";
import {
  schonEntschieden,
  offeneAnfrage,
  uebernehmeBetreuung,
  frageDenAnderen,
} from "@/lib/care/entscheidung";
import { notifyUserId } from "@/lib/push/notify";
import { haushaltProfil } from "@/lib/haushalt/profil";
import { removeCareBlock } from "@/lib/care/block-sync";
import { frageFaellig } from "@/lib/care/frage-zeit";
import { invalidateKalender } from "@/lib/calendar/range-data";
import { startOfDayBerlin, dayKey } from "@/lib/calendar/format";
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

type Ergebnis = { ok: boolean; undo?: StapelUndo; schon?: string };

const kindName = async () => (await haushaltProfil()).kind;

function reval() {
  revalidatePath("/woche");
  revalidatePath("/aufgaben");
}

/** Stand der Betreuungsentscheidung vor der Änderung — für die Gegenbuchung. */
async function careVorher(uid: string, occurrenceISO: string) {
  const c = await getCareForOccurrence(uid, new Date(occurrenceISO));
  return c ? { status: c.status, responsibleUserId: c.responsibleUserId } : null;
}

/** Offene Betreuungs-Anfrage zu diesem Vorkommen — von wem auch immer. */
async function offeneAnfrageAnMich(uid: string, occurrenceISO: string, meineId: string) {
  const a = await offeneAnfrage(uid, occurrenceISO);
  return a && a.toUserId === meineId ? a : null;
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

  // Die Entscheidung selbst steht in lib/care/entscheidung.ts — hier bleibt
  // nur, was der Stapel darüber hinaus braucht: die Gegenbuchung.
  const r = await uebernehmeBetreuung(uid, occurrenceISO, session.user.id);
  if (r.art === "schon") return { ok: true, schon: r.text };

  invalidateKalender();
  reval();
  return r.art === "antwort"
    ? { ok: true, undo: { art: "antwort-zurueck", requestId: r.requestId, eventUid: uid } }
    : { ok: true, undo: { art: "care-stand", uid, occurrenceISO, vorher } };
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
  const schon = await schonEntschieden(vorher, session.user.id);
  if (schon) return { ok: true, schon };

  await dismissCare(uid, new Date(occurrenceISO));
  await dismissTitle(title, session.user.id);
  // Hing daran eine offene Frage des anderen an mich, ist sie damit beantwortet
  // — und er soll es erfahren, statt weiter auf Antwort zu warten.
  const anfrage = await prisma.request.findFirst({
    where: { eventUid: uid, toUserId: session.user.id, status: "open", type: "yes_no" },
    select: { id: true, fromUserId: true },
  });
  if (anfrage) {
    await prisma.request.update({
      where: { id: anfrage.id },
      data: { status: "answered", answer: `Nicht nötig — ${await kindName()} ist dabei` },
    });
    await notifyUserId(anfrage.fromUserId, {
      title: "Keine Betreuung nötig",
      body: `${title} — ${await kindName()} ist dabei.`,
      url: `/termin/${encodeURIComponent(uid)}`,
      tag: `care-${anfrage.id}`,
    }).catch(() => {});
  }
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
  const schon = await schonEntschieden(vorher, session.user.id);
  if (schon) return { ok: true, schon };

  if (vorher?.status === "offen") {
    // Der andere hat schon „Ich kann nicht" gesagt und mich gefragt. Mein
    // „Ich kann nicht" ist das Nein darauf — damit steht fest: Ihr könnt
    // beide nicht, und die Eskalation (Babysitter?) übernimmt.
    const anfrage = await offeneAnfrageAnMich(uid, occurrenceISO, session.user.id);
    if (anfrage) {
      await answerRequest(anfrage.id, session.user.id, "Nein");
      invalidateKalender();
      reval();
      return { ok: true, undo: { art: "antwort-zurueck", requestId: anfrage.id, eventUid: uid } };
    }
  }

  const gefragt = await frageDenAnderen(uid, occurrenceISO, session.user.id, title);
  if (gefragt.art === "schon") return { ok: true, schon: gefragt.text };
  if (gefragt.art === "lief-schon") return { ok: true, schon: "Deine Anfrage ist schon unterwegs" };
  const requestId = gefragt.requestId;
  invalidateKalender();
  reval();
  return {
    ok: true,
    undo: { art: "care-stand", uid, occurrenceISO, vorher, anfrageWeg: requestId ?? undefined },
  };
}

/**
 * Eskalation: Jemand von außen ist organisiert. `wer` sagt, wer kommt (Oma,
 * Opa, Babysitter) — der Name steht dann im Kalenderblock („👶 Nicolas · Oma")
 * und der andere bekommt die Nachricht, damit niemand doppelt telefoniert.
 */
export async function stapelBabysitterAction(
  uid: string,
  occurrenceISO: string | null,
  wer: string | null = null,
): Promise<Ergebnis> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const iso = occurrenceISO ?? new Date().toISOString();
  const vorher = await careVorher(uid, iso);
  const schon = await schonEntschieden(vorher, session.user.id);
  if (schon) return { ok: true, schon };

  const name = wer?.trim() || "Babysitter";
  await externCare(uid, new Date(iso), name);
  try {
    const event = await prisma.event.findFirst({ where: { uid }, select: { title: true } });
    const partner = await resolvePartner(session.user.id);
    if (partner) {
      await notifyUserId(partner.id, {
        title: `✓ ${name} ist bei ${await kindName()}`,
        body: event?.title ?? "Betreuung ist organisiert.",
        url: `/termin/${encodeURIComponent(uid)}`,
        tag: `care-extern-${uid}`,
      });
    }
  } catch {
    /* Push ist best effort. */
  }
  invalidateKalender();
  reval();
  return { ok: true, undo: { art: "care-stand", uid, occurrenceISO: iso, vorher } };
}

/**
 * Der Wenn-dann-Weg auf der Eskalations-Karte: statt „später irgendwann"
 * ein konkreter Plan — eine Aufgabe „Betreuung klären", fällig heute Abend
 * (oder rechtzeitig vor dem Termin). Solange sie offen ist, hält die
 * Eskalations-Karte still; wird die Betreuung geklärt, schließt sie sich
 * von selbst (schliesseKlaerungsAufgaben).
 */
export async function stapelFrageAbendAction(
  uid: string,
  occurrenceISO: string | null,
  titel: string,
): Promise<Ergebnis> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return { ok: false };
  const iso = occurrenceISO ?? new Date().toISOString();
  const vorher = await careVorher(uid, iso);
  const schon = await schonEntschieden(vorher, session.user.id);
  if (schon) return { ok: true, schon };

  const tag = dayKey(new Date(iso));
  const sourceUid = `care-frage:${uid}:${tag}`;
  const schonDa = await prisma.todo.findFirst({
    where: { sourceUid, status: "offen" },
    select: { id: true },
  });
  if (schonDa) return { ok: true, schon: "Steht schon in euren Aufgaben" };

  const me = await meinPlatz(session.user.email);
  const todo = await prisma.todo.create({
    data: {
      title: `Betreuung klären: ${titel}`,
      notes: "Oma, Opa oder Babysitter fragen — sobald jemand zusagt, am Termin eintragen.",
      dueDate: frageFaellig(new Date(), occurrenceISO ? new Date(occurrenceISO) : null),
      assignee: me,
      createdBy: me,
      eventUid: uid,
      sourceUid,
    },
  });
  reval();
  return { ok: true, undo: { art: "todo-weg", todoId: todo.id } };
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
  const schon = await schonEntschieden(vorher, session.user.id);
  if (schon) return { ok: true, schon };
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

    case "todo-weg":
      await prisma.todo.delete({ where: { id: u.todoId } }).catch(() => null);
      break;

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
