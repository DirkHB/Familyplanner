import "server-only";
import { prisma } from "@/lib/prisma";
import { parseAllowlist } from "@/lib/auth/allowlist";
import { getHaushaltFlag, setHaushaltFlag } from "./singletons";
import { haushaltProfil, KIND_VORGABE } from "./profil";

/**
 * Was fehlt diesem Haushalt noch?
 *
 * Der Assistent fragt nichts, was schon beantwortet ist. Das ist keine
 * Bequemlichkeit, sondern die Bedingung dafür, dass er auch für uns läuft:
 * Wir haben Kalender, Listen und Läden längst — uns fehlt nur der Name des
 * Kindes. Ein Assistent, der stur alle fünf Schritte durchgeht, wäre für
 * einen bestehenden Haushalt eine Zumutung und würde weggeklickt.
 *
 * Erkannt wird an den Daten selbst, nicht an einem Häkchen. Ein Häkchen
 * lügt, sobald jemand hinterher etwas löscht.
 */

export const FERTIG_FLAG = "einrichtung.fertig";

export type SchrittName = "namen" | "kalender" | "partner" | "aufgaben" | "faecher";

export type EinrichtungStatus = {
  /** Der Assistent wurde einmal bis zum Ende durchlaufen (oder weggedrückt). */
  abgeschlossen: boolean;
  erledigt: Record<SchrittName, boolean>;
  /** Was noch offen ist — der Assistent beginnt beim ersten davon. */
  offen: SchrittName[];
  /** Die Adresse der zweiten Person, falls eine in der Allowlist steht. */
  partnerEmail: string | null;
  /** Hat sich die zweite Person schon einmal angemeldet? */
  partnerDa: boolean;
  kind: string;
  erwachsene: { email: string; name: string }[];
};

export async function einrichtungStatus(meineEmail?: string | null): Promise<EinrichtungStatus> {
  const [profil, abgeschlossen, kalender, listen, laeden, aufgaben, users] = await Promise.all([
    haushaltProfil(),
    getHaushaltFlag(FERTIG_FLAG),
    prisma.calendarAccount.count({ where: { provider: "icloud" } }),
    prisma.todoList.count(),
    prisma.store.count(),
    prisma.todo.count(),
    prisma.user.findMany({ select: { email: true, emailVerified: true } }),
  ]);

  const meine = (meineEmail ?? "").trim().toLowerCase();
  const partnerEmail =
    parseAllowlist(process.env.ALLOWED_EMAILS).find((e) => e !== meine) ?? null;
  const partnerDa = partnerEmail
    ? users.some((u) => u.email.toLowerCase() === partnerEmail && !!u.emailVerified)
    : false;

  // Namen gelten als gesetzt, wenn das Kind einen echten Namen hat und beide
  // Erwachsenen nicht mehr nur ihre E-Mail-Adresse als Namen tragen.
  const namenGesetzt =
    profil.kind !== KIND_VORGABE &&
    profil.erwachsene.every((e) => e.name && e.name !== e.email.split("@")[0]);

  const erledigt: Record<SchrittName, boolean> = {
    namen: namenGesetzt,
    kalender: kalender > 0,
    partner: partnerDa,
    aufgaben: aufgaben > 0,
    faecher: listen > 0 || laeden > 0,
  };

  const reihenfolge: SchrittName[] = ["namen", "kalender", "partner", "aufgaben", "faecher"];
  return {
    abgeschlossen,
    erledigt,
    offen: reihenfolge.filter((s) => !erledigt[s]),
    partnerEmail,
    partnerDa,
    kind: profil.kind,
    erwachsene: profil.erwachsene.map((e) => ({ email: e.email, name: e.name })),
  };
}

/**
 * Braucht dieser Haushalt den Assistenten jetzt?
 *
 * Nur solange er nie abgeschlossen wurde UND wirklich etwas fehlt. Wer ihn
 * einmal durchlaufen oder bewusst weggedrückt hat, sieht ihn nie wieder —
 * alles Übrige steht in den Einstellungen.
 */
export async function brauchtEinrichtung(meineEmail?: string | null): Promise<boolean> {
  const s = await einrichtungStatus(meineEmail);
  return !s.abgeschlossen && s.offen.length > 0;
}

export async function einrichtungAbschliessen(): Promise<void> {
  await setHaushaltFlag(FERTIG_FLAG, true);
}
