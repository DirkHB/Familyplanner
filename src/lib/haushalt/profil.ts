import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { notnameAusEmail } from "@/lib/auth/allowlist";
import { aktuellerHaushalt } from "./aktuell";
import { mitHaushalt } from "./kontext";
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
 * Danach kam die Antwort aus ALLOWED_EMAILS. Das war ein Schritt weiter und
 * trotzdem eine Sackgasse: eine Umgebungsvariable kennt nur eine Wohnung. Wer
 * einen zweiten Haushalt einlädt, müsste sie ändern — und jeder dritte
 * Haushalt stünde in derselben Liste wie der erste.
 *
 * Jetzt sind die Bewohner das, was in der Tabelle steht: die Nutzerzeilen
 * dieses Haushalts, in der Reihenfolge, in der sie dazugekommen sind. Der
 * erste ist Person A. Das Kind heißt, was in den Einstellungen steht.
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

const TAG = (haushalt: string) => `haushalt-profil:${haushalt}`;

export async function invalidateProfil() {
  revalidateTag(TAG(await aktuellerHaushalt("Profil-Zwischenspeicher")));
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
  const [users, kindWert] = await Promise.all([
    prisma.user.findMany({
      // Wer zuerst da war, ist Person A. Das ist keine Rangfolge, sondern die
      // einzige Reihenfolge, die sich nicht mehr ändert — Namen und Adressen
      // dürfen das.
      orderBy: [{ createdAt: "asc" }, { email: "asc" }],
      select: { email: true, name: true, slot: true },
    }),
    prisma.appSetting.findFirst({ where: { key: KIND_SCHLUESSEL } }),
  ]);

  const erwachsene: PersonProfil[] = users.map((u, i) => ({
    // Wer schon einen Platz in der Datenbank hat, behält ihn — sonst verlören
    // Aufgaben und Betreuungen ihre Zuordnung, sobald jemand dazukommt.
    slot: (u.slot as Platz | null) ?? platzNachReihenfolge(i),
    // Ein Platz-Wert ist kein Name. Steht er in der Spalte, gilt der Name als
    // nicht gesetzt — dann fragt der Assistent danach, statt ihn anzuzeigen.
    name: !u.name || istPlatzWert(u.name) ? notnameAusEmail(u.email) : u.name,
    email: u.email.toLowerCase(),
  }));

  return { erwachsene, kind: kindWert?.value?.trim() || KIND_VORGABE };
}

/**
 * Ein Zwischenspeicher je Haushalt — Schlüssel und Marke tragen ihn beide.
 * Ohne das teilten sich zwei Haushalte denselben Eintrag, und die zweite
 * Familie sähe die Namen der ersten.
 */
const lader = new Map<string, () => Promise<HaushaltProfil>>();

function ladeFuer(haushalt: string) {
  const vorhanden = lader.get(haushalt);
  if (vorhanden) return vorhanden;
  const neu = unstable_cache(
    // Was zwischengespeichert wird, läuft nicht zwingend im Kontext der
    // Anfrage, die es angefordert hat — der Haushalt wird deshalb ausdrücklich
    // wieder gesetzt.
    () => mitHaushalt(haushalt, ladeProfil),
    ["haushalt-profil", haushalt],
    { revalidate: 300, tags: [TAG(haushalt)] },
  );
  lader.set(haushalt, neu);
  return neu;
}

export async function haushaltProfil(): Promise<HaushaltProfil> {
  return ladeFuer(await aktuellerHaushalt("Haushaltsprofil"))();
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
  // Beim Nutzer steht der Haushalt ausdrücklich da und wird nicht eingesetzt:
  // Wer zu wem gehört, ist die eine Zuordnung, die man sehen können muss.
  const angelegt = await prisma.user.create({
    data: {
      householdId: await aktuellerHaushalt("stelleUserSicher"),
      email: adresse,
      name: notnameAusEmail(adresse),
      slot: freierPlatz(profil),
    },
  });
  await invalidateProfil();
  return angelegt;
}

/**
 * Der Platz, den in diesem Haushalt noch niemand hat.
 *
 * Zwei Erwachsene teilen sich eine Wohnung; kommt wider Erwarten ein dritter
 * dazu, bekommt er Platz A. Das ist keine gute Antwort, aber eine ehrliche —
 * besser als ein Platz, der nirgends vorgesehen ist und dann überall fehlt.
 */
function freierPlatz(profil: HaushaltProfil): Platz {
  const belegt = new Set(profil.erwachsene.map((e) => e.slot));
  return platzNachReihenfolge(belegt.has(PLATZ_A) ? 1 : 0);
}

/** Den Namen des Kindes setzen. Leer heißt: zurück zur neutralen Vorgabe. */
export async function setKindName(name: string): Promise<void> {
  const wert = name.trim();
  const vorhanden = await prisma.appSetting.findFirst({
    where: { key: KIND_SCHLUESSEL },
    select: { key: true },
  });
  if (vorhanden) {
    await prisma.appSetting.updateMany({ where: { key: KIND_SCHLUESSEL }, data: { value: wert } });
  } else {
    await prisma.appSetting.create({ data: { key: KIND_SCHLUESSEL, value: wert } });
  }
  await invalidateProfil();
}
