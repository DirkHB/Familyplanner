"use server";

import { signIn } from "@/auth";
import { pruefeToken } from "@/lib/einladung/store";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

/**
 * Den Anmeldelink anfordern — aber nur an die eingeladene Adresse.
 *
 * Die Adresse kommt aus der Einladung, nicht aus dem Formular. Das ist der
 * ganze Unterschied zu einem offenen Anmeldeformular: Wer den Link
 * weiterleitet, verschenkt keinen Zugang, sondern nur einen Weg, dem
 * ursprünglich Eingeladenen eine Mail zu schicken.
 */
export async function einladungAnnehmenAction(
  token: string,
): Promise<{ ok: boolean; email?: string; grund?: string }> {
  const pruefung = await pruefeToken(token);
  if (pruefung.art !== "gueltig") {
    return { ok: false, grund: "Diese Einladung gilt nicht mehr." };
  }

  const email = pruefung.einladung.email;
  const rl = rateLimit(`magic:${email}`, LIMITS.magicLink.limit, LIMITS.magicLink.windowMs);
  if (!rl.ok) {
    return { ok: false, grund: "Zu viele Anmelde-Links angefordert. Bitte kurz warten." };
  }

  await signIn("resend", { email, redirectTo: "/einrichten" });
  return { ok: true, email };
}
