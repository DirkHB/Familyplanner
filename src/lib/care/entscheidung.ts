import "server-only";
import { prisma } from "@/lib/prisma";
import { notnameAusEmail } from "@/lib/auth/allowlist";
import { haushaltProfil } from "@/lib/haushalt/profil";
import { answerRequest } from "@/lib/requests/repository";
import { getCareForOccurrence, takeCare, requestCare } from "./repository";

/**
 * „Wer ist beim Kind?" — die Entscheidung, an einer Stelle.
 *
 * Sie war zweimal gebaut: im Klärungs-Stapel vollständig, am Termin-Detail
 * verkürzt. Am Detail fehlten dadurch zwei Dinge, die im Alltag wehtun. Wer
 * dort „Ich mache es" tippte, nachdem er selbst gefragt hatte, ließ die Frage
 * beim anderen stehen — der bekam den Push „✓ Dirk ist bei Nicolas" und wurde
 * danach weiter erinnert, eine Frage zu beantworten, die niemand mehr hatte.
 * Und die Frische-Prüfung fehlte: Hatte der andere gerade zugesagt,
 * überschrieb das eigene Tippen seine Zusage stillschweigend.
 *
 * Solche Lücken entstehen nicht aus Unachtsamkeit, sondern daraus, dass
 * dieselbe Entscheidung an zwei Orten steht. Deshalb steht sie jetzt hier, und
 * beide Wege rufen dasselbe auf.
 */

export type CareStand = { status: string; responsibleUserId: string | null } | null;

/** Was gilt gerade für dieses Vorkommen? Grundlage jeder Gegenbuchung. */
export async function careStand(uid: string, occurrenceISO: string): Promise<CareStand> {
  const c = await getCareForOccurrence(uid, new Date(occurrenceISO));
  return c ? { status: c.status, responsibleUserId: c.responsibleUserId } : null;
}

/**
 * Hat es der andere inzwischen entschieden?
 *
 * Die Karte im Stapel ist ein Schnappschuss vom Öffnen; das Termin-Detail ist
 * einer vom Laden der Seite. Beide dürfen eine frischere Entscheidung nicht
 * überschreiben — sonst nimmt ein „Ich kann nicht" die Zusage des anderen
 * wieder weg. Gibt diese Funktion einen Text zurück, wird nicht geschrieben,
 * sondern gesagt, was längst gilt.
 */
export async function schonEntschieden(vorher: CareStand, meineId: string): Promise<string | null> {
  if (!vorher) return null;
  const kind = (await haushaltProfil()).kind;
  if (vorher.status === "geklaert" || vorher.status === "zugesagt") {
    if (vorher.responsibleUserId === meineId) return "Du bist schon eingetragen ✓";
    if (vorher.responsibleUserId) {
      const wer = await prisma.user.findUnique({
        where: { id: vorher.responsibleUserId },
        select: { email: true, name: true },
      });
      const name = wer ? (wer.name ?? notnameAusEmail(wer.email)) : "Der andere";
      return `${name} ist schon bei ${kind} ✓`;
    }
    return "Schon geklärt ✓";
  }
  if (vorher.status === "extern") return "Schon geklärt — Babysitter übernimmt ✓";
  if (vorher.status === "keine") return "Schon geklärt — keine Betreuung nötig";
  return null; // „offen" behandelt jede Aktion selbst
}

/** Tagesbeginn in UTC — so liegen Betreuungen und Anfragen auf demselben Anker. */
function tagesAnker(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Die offene Betreuungsfrage zu genau diesem Vorkommen.
 *
 * `occurrenceDate: null` sind Anfragen von vor Migration 0016 — die galten dem
 * Termin allgemein und werden deshalb weiter mitgenommen.
 */
export async function offeneAnfrage(uid: string, occurrenceISO: string) {
  const tag = tagesAnker(new Date(occurrenceISO));
  return prisma.request.findFirst({
    where: {
      eventUid: uid,
      status: "open",
      type: "yes_no",
      OR: [{ occurrenceDate: tag }, { occurrenceDate: null }],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, fromUserId: true, toUserId: true, createdAt: true },
  });
}

export type UebernahmeErgebnis =
  | { art: "schon"; text: string }
  | { art: "antwort"; requestId: string }
  | { art: "uebernommen" };

/**
 * „Ich mache es."
 *
 * Drei Fälle, in dieser Reihenfolge:
 *  1. Der andere hat es schon entschieden → nichts schreiben, nur sagen.
 *  2. Der andere hat MICH gefragt → das ist ein „Ja" auf seine Frage, keine
 *     Zusage daneben. So erfährt er es und die Frage verschwindet bei ihm.
 *  3. Sonst übernehmen — und eine eigene, noch offene Frage an ihn einsammeln.
 *     Sie ist gegenstandslos, sobald ich es selbst mache.
 */
export async function uebernehmeBetreuung(
  uid: string,
  occurrenceISO: string,
  meineId: string,
): Promise<UebernahmeErgebnis> {
  const vorher = await careStand(uid, occurrenceISO);
  const schon = await schonEntschieden(vorher, meineId);
  if (schon) return { art: "schon", text: schon };

  const anfrage = await offeneAnfrage(uid, occurrenceISO);
  if (anfrage && anfrage.toUserId === meineId) {
    await answerRequest(anfrage.id, meineId, "Ja");
    return { art: "antwort", requestId: anfrage.id };
  }

  await takeCare(uid, new Date(occurrenceISO), meineId);
  await raeumeEigeneFrageWeg(uid, occurrenceISO, meineId);
  return { art: "uebernommen" };
}

/**
 * Meine eigene offene Frage zu diesem Vorkommen zurücknehmen.
 *
 * Gelöscht statt beantwortet: Eine Frage, die ich selbst hinfällig gemacht
 * habe, ist keine beantwortete Frage. Sie im Verlauf stehen zu lassen hieße,
 * dem anderen eine Antwort unterzuschieben, die er nie gegeben hat.
 */
async function raeumeEigeneFrageWeg(uid: string, occurrenceISO: string, meineId: string) {
  const tag = tagesAnker(new Date(occurrenceISO));
  await prisma.request
    .deleteMany({
      where: {
        eventUid: uid,
        fromUserId: meineId,
        status: "open",
        type: "yes_no",
        OR: [{ occurrenceDate: tag }, { occurrenceDate: null }],
      },
    })
    .catch(() => null);
}

export type FrageErgebnis =
  | { art: "schon"; text: string }
  | { art: "lief-schon"; requestId: string }
  | { art: "gefragt"; requestId: string | null };

/**
 * „Den anderen fragen."
 *
 * Genau einmal, bis eine Antwort da ist. Vorher legte jeder Tipp eine weitere
 * Anfrage an: fünf Karten beim anderen, fünf Pushes — und weil je Anfrage
 * erinnert wird, danach fünf Erinnerungen am Tag. Läuft schon eine, passiert
 * jetzt nichts, und die Oberfläche sagt es.
 *
 * Nach einer Antwort ist der Weg wieder frei. Ein „Geht nicht" darf nicht
 * heißen, dass man nie wieder fragen kann — man redet ja abends darüber, und
 * dann ändert sich etwas.
 */
export async function frageDenAnderen(
  uid: string,
  occurrenceISO: string,
  meineId: string,
  titel: string,
): Promise<FrageErgebnis> {
  const vorher = await careStand(uid, occurrenceISO);
  const schon = await schonEntschieden(vorher, meineId);
  if (schon) return { art: "schon", text: schon };

  const laufend = await offeneAnfrage(uid, occurrenceISO);
  if (laufend && laufend.fromUserId === meineId) {
    return { art: "lief-schon", requestId: laufend.id };
  }

  const requestId = await requestCare(uid, new Date(occurrenceISO), meineId, titel);
  return { art: "gefragt", requestId };
}

/** Die eigene Frage zurückziehen, ohne selbst zu übernehmen. */
export async function ziehFrageZurueck(
  uid: string,
  occurrenceISO: string,
  meineId: string,
): Promise<{ ok: boolean }> {
  await raeumeEigeneFrageWeg(uid, occurrenceISO, meineId);
  return { ok: true };
}
