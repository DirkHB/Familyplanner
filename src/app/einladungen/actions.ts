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
): Promise<{ ok: boolean; grund?: string }> {
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

  try {
    const { token } = await ladeEin({ email: adresse, householdId: null });
    const mail = neuerHaushaltEmail({ vonName: wache.name, url: linkFuer(token) });
    await sendEmail({ to: adresse, subject: mail.subject, html: mail.html, text: mail.text });
    revalidatePath("/einladungen");
    return { ok: true };
  } catch {
    return { ok: false, grund: "Die Mail ging nicht raus. Versuch es gleich noch einmal." };
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
