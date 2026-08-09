import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { parseAllowlist, notnameAusEmail } from "@/lib/auth/allowlist";
import { haushaltId } from "./id";
import {
  PLATZ_A,
  istPlatzWert,
  platzFuerEmail,
  platzNachReihenfolge,
  type Platz,
} from "./platz";

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
  /** Der gespeicherte Platz — PLATZ_A oder PLATZ_B, siehe platz.ts. */
  slot: Platz;
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

/**
 * Der Anzeigename zu einem Platz.
 *
 * Der Rückfall war bis eben der Platz selbst — und der heißt historisch
 * „dirk"/„constanze". Fand die Suche nichts, stand in der Oberfläche also ein
 * klein geschriebener Platz-Wert da, der wie ein Name aussieht: „👶 Nicolas ·
 * constanze", „In dirks Kalender". Falsch, aber unauffällig genug, um lange
 * niemandem aufzufallen. Ein neutraler Rückfall ist unbequemer und deshalb
 * ehrlicher: Man sieht sofort, dass ein Name fehlt.
 */
export function nameFuerSlot(p: HaushaltProfil, slot: string | null | undefined): string {
  if (!slot) return "jemand";
  const treffer = p.erwachsene.find((e) => e.slot === slot);
  if (treffer && !istPlatzWert(treffer.name)) return treffer.name;
  return slot === p.erwachsene[0]?.slot ? "Person A" : "Person B";
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
  // Ein Platz-Wert ist kein Name. Steht er in der Spalte, gilt der Name als
  // nicht gesetzt — dann fragt der Assistent danach, statt ihn anzuzeigen.
  const nameFuer = new Map(
    users.map((u) => [u.email.toLowerCase(), istPlatzWert(u.name) ? null : u.name] as const),
  );
  const slotFuer = new Map(users.map((u) => [u.email.toLowerCase(), u.slot]));

  const erwachsene: PersonProfil[] = emails.map((email, i) => ({
    // Die Reihenfolge der Allowlist bestimmt den Platz. Wer schon einen in
    // der Datenbank hat, behält ihn — sonst verlören Aufgaben ihre Zuordnung,
    // sobald jemand die Umgebungsvariable umsortiert.
    slot: (slotFuer.get(email) as Platz | null) ?? platzNachReihenfolge(i),
    name: nameFuer.get(email) ?? notnameAusEmail(email),
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

/** Der Platz der angemeldeten Person — der Einstieg für fast jede Aktion. */
export async function meinPlatz(email: string | null | undefined): Promise<Platz> {
  return platzFuerEmail(await haushaltProfil(), email);
}

/**
 * Die Nutzerzeile zu einer Adresse — angelegt, falls es sie noch nicht gibt.
 *
 * Nötig, weil Zeilen erst beim ersten Login entstehen: Der Worker will
 * jemandem eine Aufgabe zuweisen oder eine Frage schicken, bevor die Person
 * je da war. Das stand an sechs Stellen als eigenes `upsert` — jedes mit
 * seiner eigenen Vorstellung davon, was in `name` gehört, und keines hat den
 * Platz gesetzt. Ein zweiter Haushalt hätte damit Zeilen ohne Platz bekommen.
 */
export async function stelleUserSicher(email: string) {
  const adresse = email.trim().toLowerCase();
  const profil = await haushaltProfil();
  const eintrag = profil.erwachsene.find((e) => e.email === adresse);
  const vorhanden = await prisma.user.findUnique({ where: { email: adresse } });
  if (vorhanden) {
    // Fehlt nur der Platz, wird er nachgetragen — ohne den Namen anzufassen,
    // den die Person vielleicht selbst gesetzt hat.
    if (!vorhanden.slot && eintrag) {
      return prisma.user.update({ where: { id: vorhanden.id }, data: { slot: eintrag.slot } });
    }
    return vorhanden;
  }
  return prisma.user.create({
    data: {
      email: adresse,
      name: eintrag?.name ?? notnameAusEmail(adresse),
      slot: eintrag?.slot ?? PLATZ_A,
    },
  });
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
