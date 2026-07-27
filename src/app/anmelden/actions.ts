"use server";

import { signIn } from "@/auth";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  // Freundlich abfangen, bevor NextAuth wirft (kein Versand an Fremde).
  if (!isAllowedEmail(email)) {
    return { error: "Diese Adresse ist nicht freigeschaltet." };
  }
  // Missbrauch/Spam des Magic-Link-Versands begrenzen (pro Adresse).
  const rl = rateLimit(`magic:${email.toLowerCase()}`, LIMITS.magicLink.limit, LIMITS.magicLink.windowMs);
  if (!rl.ok) {
    return { error: "Zu viele Anmelde-Links angefordert. Bitte kurz warten." };
  }
  await signIn("resend", { email, redirectTo: "/" });
  return { error: null };
}
