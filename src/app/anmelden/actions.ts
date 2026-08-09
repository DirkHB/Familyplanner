"use server";

import { signIn } from "@/auth";
import { darfSichAnmelden } from "@/lib/einladung/store";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  // Freundlich abfangen, bevor NextAuth wirft (kein Versand an Fremde).
  if (!(await darfSichAnmelden(email))) {
    return { error: "Diese Adresse ist nicht eingeladen." };
  }
  // Missbrauch/Spam des Magic-Link-Versands begrenzen (pro Adresse).
  const rl = rateLimit(`magic:${email.toLowerCase()}`, LIMITS.magicLink.limit, LIMITS.magicLink.windowMs);
  if (!rl.ok) {
    return { error: "Zu viele Anmelde-Links angefordert. Bitte kurz warten." };
  }
  await signIn("resend", { email, redirectTo: "/" });
  return { error: null };
}
