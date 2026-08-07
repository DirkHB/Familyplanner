import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseAllowlist } from "@/lib/auth/allowlist";
import { haushaltId } from "./id";

/**
 * Wer wohnt hier, und wie heißt das Kind?
 *
 * Bisher stand das im Code: drei E-Mail-Adressen entschieden, wer „Dirk" und
 * wer „Constanze" ist, und „Nicolas" stand an vierzig Stellen fest. Für einen
 * zweiten Haushalt war das nicht bloß unschön, sondern falsch — jede
 * unbekannte Adresse wurde zu „Constanze", also wären dort beide dieselbe
 * Person gewesen.
 *
 * Jetzt kommen die Namen aus der Datenbank. Zwei Erwachsene in fester
 * Reihenfolge (die erste Adresse der Allowlist ist Person A) und ein Kind,
 * dessen Name in den Einstellungen liegt.
 *
 * Kurz zwischengespeichert, weil fast jede Ansicht ihn braucht; jede Änderung
 * am Profil räumt den Speicher selbst ab.
 */

export type PersonProfil = {
  /** Der gespeicherte Wert in Aufgaben, Einkauf und Verlauf. */
  slot: string;
  name: string;
  email: string;
};

export type HaushaltProfil = {
  erwachsene: PersonProfil[];
  /** Der Name des Kindes — „Nicolas", solange nichts anderes gesetzt ist. */
  kind: string;
};

/** Solange nichts eingerichtet ist. Die App muss vom ersten Bild an lesbar sein. */
export const KIND_VORGABE = "das Baby";
export const KIND_SCHLUESSEL = "kind.name";

const TAG = () => `haushalt-profil:${haushaltId()}`;

export function invalidateProfil() {
  revalidateTag(TAG());
}

/** Der Anzeigename zu einem gespeicherten Platz („dirk"/"constanze"). */
export function nameFuerSlot(p: HaushaltProfil, slot: string | null | undefined): string {
  if (!slot) return "jemand";
  return p.erwachsene.find((e) => e.slot === slot)?.name ?? slot;
}

/** Beide Namen in fester Reihenfolge — „Constanze und Dirk", nie umgekehrt. */
export function beideNamen(p: HaushaltProfil): string {
  const n = p.erwachsene.map((e) => e.name);
  if (n.length === 0) return "ihr";
  if (n.length === 1) return n[0];
  return `${n[0]} und ${n[1]}`;
}

async function ladeProfil(): Promise<HaushaltProfil> {
  const emails = parseAllowlist(process.env.ALLOWED_EMAILS);
  const [users, kindWert] = await Promise.all([
    prisma.user.findMany({ select: { email: true, name: true, slot: true } }),
    prisma.appSetting.findUnique({ where: { key: `${haushaltId()}:${KIND_SCHLUESSEL}` } }),
  ]);
  const nameFuer = new Map(users.map((u) => [u.email.toLowerCase(), u.name]));
  const slotFuer = new Map(users.map((u) => [u.email.toLowerCase(), u.slot]));

  const erwachsene: PersonProfil[] = emails.map((email, i) => ({
    // Die Reihenfolge der Allowlist bestimmt den Platz. Wer schon einen in
    // der Datenbank hat, behält ihn — sonst verlören Aufgaben ihre Zuordnung,
    // sobald jemand die Umgebungsvariable umsortiert.
    slot: slotFuer.get(email) ?? (i === 0 ? "a" : "b"),
    name: nameFuer.get(email) ?? email.split("@")[0],
    email,
  }));

  return { erwachsene, kind: kindWert?.value?.trim() || KIND_VORGABE };
}

const geladen = unstable_cache(ladeProfil, ["haushalt-profil"], {
  revalidate: 300,
  tags: [TAG()],
});

export async function haushaltProfil(): Promise<HaushaltProfil> {
  return geladen();
}

/** Den Namen des Kindes setzen. Leer heißt: zurück zur neutralen Vorgabe. */
export async function setKindName(name: string): Promise<void> {
  const key = `${haushaltId()}:${KIND_SCHLUESSEL}`;
  const wert = name.trim();
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: wert },
    update: { value: wert },
  });
  invalidateProfil();
}
