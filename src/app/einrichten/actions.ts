"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

/**
 * Die Schritte des Einrichtungs-Assistenten.
 *
 * Bewusst dünn: Namen, Kalender, Listen und der Aufgaben-Import haben ihre
 * Aktionen längst in den Einstellungen. Hier steht nur, was es vorher nicht
 * gab — die Einladung und das Abschließen.
 */

/**
 * Die zweite Person einladen.
 *
 * Bis eben sagte die Einladung einer Adresse, die ohnehin schon freigeschaltet
 * war, dass es die App jetzt gibt — Zugang verteilte eine Umgebungsvariable.
 * Jetzt ist die Einladung der Zugang: ein einmaliger Link, gebunden an genau
 * diese Adresse, vierzehn Tage gültig.
 *
 * Der Haushalt steht dabei fest — es ist der des Einladenden. Wer hier
 * einlädt, holt jemanden in die eigene Wohnung, nicht in eine neue.
 */
export async function ladePartnerEinAction(
  email: string,
): Promise<{ ok: boolean; grund?: string }> {
  const session = await auth();
  if (!session?.user?.email || !session.user.householdId) {
    return { ok: false, grund: "Nicht angemeldet." };
  }

  const adresse = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse)) {
    return { ok: false, grund: "Das sieht nicht nach einer E-Mail-Adresse aus." };
  }
  if (adresse === session.user.email.trim().toLowerCase()) {
    return { ok: false, grund: "Das bist du selbst." };
  }

  const { prismaRoh } = await import("@/lib/prisma");
  const { ladeEin, linkFuer } = await import("@/lib/einladung/store");
  const { haushaltProfil } = await import("@/lib/haushalt/profil");
  const { sendEmail } = await import("@/lib/email/send");
  const { einladungEmail } = await import("@/lib/email/einladung");

  // Wer schon irgendwo wohnt, kann nicht zweimal einziehen. Ohne diese Frage
  // bekäme die Person eine Einladung, die beim Einlösen scheitert — und der
  // Fehler stünde dann bei ihr, nicht bei dem, der sie geschickt hat.
  const schonDa = await prismaRoh.user.findUnique({
    where: { email: adresse },
    select: { householdId: true },
  });
  if (schonDa) {
    return schonDa.householdId === session.user.householdId
      ? { ok: false, grund: "Die Person ist schon dabei." }
      : { ok: false, grund: "Diese Adresse gehört schon zu einem anderen Haushalt." };
  }

  const profil = await haushaltProfil();
  const meine = session.user.email.trim().toLowerCase();
  const vonName = profil.erwachsene.find((e) => e.email === meine)?.name ?? "Jemand";

  try {
    const { token } = await ladeEin({ email: adresse, householdId: session.user.householdId });
    const mail = einladungEmail({
      an: adresse,
      vonName,
      kind: profil.kind,
      url: linkFuer(token),
    });
    await sendEmail({ to: adresse, subject: mail.subject, html: mail.html, text: mail.text });
    revalidatePath("/einrichten");
    revalidatePath("/einstellungen");
    return { ok: true };
  } catch {
    return { ok: false, grund: "Die Mail ging nicht raus. Versuch es gleich noch einmal." };
  }
}

/** Fertig — der Assistent kommt nicht wieder. Alles Weitere steht in den Einstellungen. */
export async function einrichtungFertigAction(): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const { einrichtungAbschliessen } = await import("@/lib/haushalt/einrichtung");
  await einrichtungAbschliessen();
  revalidatePath("/woche");
  revalidatePath("/einrichten");
  return { ok: true };
}
