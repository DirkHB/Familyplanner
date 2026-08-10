"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

/**
 * Einen neuen Haushalt einladen.
 *
 * Das ist der Weg, auf dem Freunde hereinkommen — und der einzige Grund, warum
 * es überhaupt ein Verwaltungsrecht gibt. Wer die Einladung annimmt, bekommt
 * beim ersten Anmelden eine eigene Wohnung: eigener Kalender, eigene Namen,
 * eigene Listen. Nichts davon berührt uns.
 *
 * Danach ist die App für diese Familie fertig eingerichtet, ohne dass hier
 * jemand etwas anfassen müsste. Genau das war der Punkt.
 */
export async function ladeHaushaltEinAction(
  email: string,
): Promise<{ ok: boolean; link?: string; mailRaus?: boolean; grund?: string }> {
  const wache = await nurVerwaltung();
  if (!wache.ok) return wache;

  const adresse = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse)) {
    return { ok: false, grund: "Das sieht nicht nach einer E-Mail-Adresse aus." };
  }

  const { prismaRoh } = await import("@/lib/prisma");
  const { ladeEin, linkFuer } = await import("@/lib/einladung/store");
  const { sendEmail } = await import("@/lib/email/send");
  const { neuerHaushaltEmail } = await import("@/lib/email/einladung");

  const schonDa = await prismaRoh.user.findUnique({
    where: { email: adresse },
    select: { id: true },
  });
  if (schonDa) return { ok: false, grund: "Diese Adresse ist schon dabei." };

  /*
   * Erst die Einladung, dann die Mail — und beide getrennt betrachtet.
   *
   * Vorher lag beides in einem try: Ging die Mail nicht raus, hieß es „hat
   * nicht geklappt", obwohl die Einladung längst gültig war. Man stand dann
   * mit einem Zugang da, den niemand kennt, und ohne einen Grund, der
   * irgendwo stünde.
   */
  const { token } = await ladeEin({ email: adresse, householdId: null });
  const link = linkFuer(token);

  try {
    const mail = neuerHaushaltEmail({ vonName: wache.name, url: link });
    await sendEmail({ to: adresse, subject: mail.subject, html: mail.html, text: mail.text });
    revalidatePath("/einladungen");
    return { ok: true, link, mailRaus: true };
  } catch (err) {
    // Der Grund gehört ins Log, nicht ins Nichts. Resend sagt genau, was es
    // nicht mochte — bisher hat das niemand je zu sehen bekommen.
    console.error(
      JSON.stringify({
        service: "einladung",
        an: adresse,
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    revalidatePath("/einladungen");
    return {
      ok: true,
      link,
      mailRaus: false,
      grund: "Die Einladung gilt, aber die Mail ging nicht raus. Schick den Link selbst.",
    };
  }
}

/** Eine Einladung zurücknehmen, solange sie noch niemand eingelöst hat. */
export async function ziehEinladungZurueckAction(
  id: string,
): Promise<{ ok: boolean; grund?: string }> {
  const wache = await nurVerwaltung();
  if (!wache.ok) return wache;

  const { prismaRoh } = await import("@/lib/prisma");
  await prismaRoh.invite.deleteMany({ where: { id, usedAt: null } });
  revalidatePath("/einladungen");
  return { ok: true };
}

/**
 * Einen Haushalt löschen — mit allem, was darin liegt.
 *
 * Das ist die eine unwiderrufliche Handlung in dieser App. Deshalb drei
 * Riegel: nur die Verwaltung, niemals der eigene Haushalt, und die Bestätigung
 * muss abgetippt werden. Ein „Wirklich löschen?"-Fenster klickt man weg, ohne
 * es gelesen zu haben; eine Adresse tippt niemand versehentlich ab.
 *
 * Der eigene Haushalt ist ausgenommen, weil das Löschen sonst die Sitzung
 * mitnähme, aus der die Berechtigung dafür kommt — und niemand mehr da wäre,
 * der einladen kann.
 */
export async function loescheHaushaltAction(
  id: string,
  bestaetigung: string,
): Promise<{ ok: boolean; grund?: string }> {
  const wache = await nurVerwaltung();
  if (!wache.ok) return wache;

  const session = await auth();
  if (session?.user?.householdId === id) {
    return { ok: false, grund: "Den eigenen Haushalt kannst du hier nicht löschen." };
  }

  const { prismaRoh } = await import("@/lib/prisma");
  const { abtippen } = await import("@/lib/einladung/abtippen");
  const haushalt = await prismaRoh.household.findUnique({
    where: { id },
    select: { id: true, users: { orderBy: { createdAt: "asc" }, select: { email: true } } },
  });
  if (!haushalt) return { ok: false, grund: "Diesen Haushalt gibt es nicht mehr." };

  if (bestaetigung.trim().toLowerCase() !== abtippen(haushalt).toLowerCase()) {
    return { ok: false, grund: "Das stimmt nicht überein — nichts gelöscht." };
  }

  // Die Fremdschlüssel räumen den Rest weg: Termine, Aufgaben, Einkauf,
  // Betreuungen, Einladungen. Siehe Migration 0018.
  await prismaRoh.household.delete({ where: { id } });
  revalidatePath("/einladungen");
  return { ok: true };
}

type Wache = { ok: true; name: string } | { ok: false; grund: string };

async function nurVerwaltung(): Promise<Wache> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, grund: "Nicht angemeldet." };
  const { prismaRoh } = await import("@/lib/prisma");
  const ich = await prismaRoh.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true, name: true, email: true },
  });
  if (!ich?.isAdmin) return { ok: false, grund: "Dafür fehlt dir die Berechtigung." };
  const { notnameAusEmail } = await import("@/lib/auth/allowlist");
  return { ok: true, name: ich.name ?? notnameAusEmail(ich.email) };
}
