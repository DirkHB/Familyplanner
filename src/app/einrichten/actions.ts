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
 * Wer Zugang hat, entscheidet die Allowlist der Instanz — daran ändert die
 * Einladung nichts. Sie sagt der Adresse, die ohnehin schon eingetragen ist,
 * dass es sie jetzt gibt. Eine Einladung, die selbst Zugang verteilt, wäre
 * ein Loch, das man einmal übersieht und nie wieder zumacht.
 */
export async function ladePartnerEinAction(): Promise<{ ok: boolean; grund?: string }> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, grund: "Nicht angemeldet." };

  const { parseAllowlist } = await import("@/lib/auth/allowlist");
  const { haushaltProfil } = await import("@/lib/haushalt/profil");
  const { sendEmail } = await import("@/lib/email/send");
  const { einladungEmail } = await import("@/lib/email/einladung");

  const meine = session.user.email.trim().toLowerCase();
  const partner = parseAllowlist(process.env.ALLOWED_EMAILS).find((e) => e !== meine);
  if (!partner) {
    return {
      ok: false,
      grund: "Es ist keine zweite Adresse hinterlegt. Die richten wir für euch ein.",
    };
  }

  const profil = await haushaltProfil();
  const vonName = profil.erwachsene.find((e) => e.email === meine)?.name ?? "Dein Partner";
  const url = process.env.AUTH_URL || "https://planyourweek.app";

  try {
    const mail = einladungEmail({ an: partner, vonName, kind: profil.kind, url: `${url}/anmelden` });
    await sendEmail({ to: partner, subject: mail.subject, html: mail.html, text: mail.text });
    return { ok: true };
  } catch {
    return { ok: false, grund: "Die Mail ging nicht raus. Schick ihr einfach den Link." };
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
