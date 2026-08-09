import "server-only";
import { prismaRoh } from "@/lib/prisma";
import { neuerToken, tokenAbdruck, laeuftAb, einladungsLink } from "./token";

/**
 * Einladungen — der einzige Weg hinein.
 *
 * Alles hier läuft über den Zugang OHNE Riegel, und das ist kein Versehen:
 * Eine Einladung wird gelesen, bevor irgendjemand angemeldet ist. Es gibt in
 * diesem Moment keinen Haushalt, aus dem ein Filter kommen könnte — die
 * Einladung IST die Auskunft darüber, welcher es wird.
 *
 * Deshalb steht in jeder Abfrage hier der Abdruck oder die Adresse als
 * Bedingung. Eine Abfrage ohne beides wäre die eine, die alle Einladungen
 * aller Haushalte sieht.
 */

export type Einladung = {
  id: string;
  email: string;
  householdId: string | null;
  expiresAt: Date;
  usedAt: Date | null;
};

/**
 * Eine Einladung ausstellen.
 *
 * `householdId` leer heißt: ein neuer Haushalt. So kommen die Freunde herein.
 * Mit Haushalt heißt: die zweite Person einer bestehenden Wohnung.
 *
 * Eine ältere, noch offene Einladung an dieselbe Adresse wird ersetzt. Sonst
 * lägen zwei gültige Links für eine Person herum, und welcher wirkt, hinge
 * davon ab, welchen sie zuerst anklickt.
 */
export async function ladeEin(input: {
  email: string;
  householdId?: string | null;
  jetzt?: Date;
}): Promise<{ token: string; einladung: Einladung }> {
  const email = input.email.trim().toLowerCase();
  const jetzt = input.jetzt ?? new Date();

  await prismaRoh.invite.deleteMany({ where: { email, usedAt: null } });

  const token = neuerToken();
  const einladung = await prismaRoh.invite.create({
    data: {
      email,
      householdId: input.householdId ?? null,
      tokenHash: tokenAbdruck(token),
      expiresAt: laeuftAb(jetzt),
    },
    select: { id: true, email: true, householdId: true, expiresAt: true, usedAt: true },
  });

  return { token, einladung };
}

export function linkFuer(token: string): string {
  const basis = process.env.AUTH_URL || "https://planyourweek.app";
  return einladungsLink(basis, token);
}

/** Was ist mit diesem Token? */
export type Pruefung =
  | { art: "gueltig"; einladung: Einladung }
  | { art: "unbekannt" }
  | { art: "verbraucht" }
  | { art: "abgelaufen"; einladung: Einladung };

export async function pruefeToken(token: string, jetzt: Date = new Date()): Promise<Pruefung> {
  if (!token?.trim()) return { art: "unbekannt" };
  const zeile = await prismaRoh.invite.findUnique({
    where: { tokenHash: tokenAbdruck(token) },
    select: { id: true, email: true, householdId: true, expiresAt: true, usedAt: true },
  });
  if (!zeile) return { art: "unbekannt" };
  if (zeile.usedAt) return { art: "verbraucht" };
  if (zeile.expiresAt.getTime() <= jetzt.getTime()) return { art: "abgelaufen", einladung: zeile };
  return { art: "gueltig", einladung: zeile };
}

/** Die offene Einladung zu einer Adresse — der Zugangsausweis beim Anmelden. */
export async function offeneEinladung(
  email: string | null | undefined,
  jetzt: Date = new Date(),
): Promise<Einladung | null> {
  const adresse = (email ?? "").trim().toLowerCase();
  if (!adresse) return null;
  return prismaRoh.invite.findFirst({
    where: { email: adresse, usedAt: null, expiresAt: { gt: jetzt } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, householdId: true, expiresAt: true, usedAt: true },
  });
}

/**
 * Darf sich diese Adresse anmelden?
 *
 * Zwei Wege, und nur diese zwei: Sie wohnt schon hier, oder sie ist gerade
 * eingeladen. Es gibt keine Liste mehr, in die jemand von Hand etwas einträgt
 * — genau das war der Punkt.
 */
export async function darfSichAnmelden(email: string | null | undefined): Promise<boolean> {
  const adresse = (email ?? "").trim().toLowerCase();
  if (!adresse) return false;
  const vorhanden = await prismaRoh.user.findUnique({
    where: { email: adresse },
    select: { id: true },
  });
  if (vorhanden) return true;
  return (await offeneEinladung(adresse)) !== null;
}

/**
 * Die Einladung einlösen: den Haushalt bestimmen und den Token verbrauchen.
 *
 * Wird genau einmal aufgerufen — in dem Moment, in dem der Adapter die
 * Nutzerzeile anlegt. Der Haushalt entsteht hier, falls die Einladung keinen
 * nennt; die Reihenfolge ist wichtig: erst der Haushalt, dann der Nutzer, denn
 * die Nutzerzeile kann ohne ihn nicht existieren.
 *
 * Das `updateMany` mit `usedAt: null` in der Bedingung ist der Riegel gegen
 * zwei gleichzeitige Anmeldungen mit demselben Link: Genau einer trifft eine
 * Zeile, der andere trifft keine.
 */
export async function loeseEin(
  email: string,
  jetzt: Date = new Date(),
): Promise<{ householdId: string; neuerHaushalt: boolean } | null> {
  const einladung = await offeneEinladung(email, jetzt);
  if (!einladung) return null;

  const verbraucht = await prismaRoh.invite.updateMany({
    where: { id: einladung.id, usedAt: null },
    data: { usedAt: jetzt },
  });
  if (verbraucht.count === 0) return null;

  if (einladung.householdId) {
    return { householdId: einladung.householdId, neuerHaushalt: false };
  }

  const haushalt = await prismaRoh.household.create({ data: {}, select: { id: true } });
  return { householdId: haushalt.id, neuerHaushalt: true };
}

/** Was in einem Haushalt gerade offen ist — für die Anzeige „schon eingeladen". */
export async function offeneEinladungenDesHaushalts(
  householdId: string,
  jetzt: Date = new Date(),
): Promise<Einladung[]> {
  return prismaRoh.invite.findMany({
    where: { householdId, usedAt: null, expiresAt: { gt: jetzt } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, householdId: true, expiresAt: true, usedAt: true },
  });
}
