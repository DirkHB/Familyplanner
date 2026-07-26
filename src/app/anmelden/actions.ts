"use server";

import { signIn } from "@/auth";
import { isAllowedEmail } from "@/lib/auth/allowlist";

export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  // Freundlich abfangen, bevor NextAuth wirft (kein Versand an Fremde).
  if (!isAllowedEmail(email)) {
    return { error: "Diese Adresse ist nicht freigeschaltet." };
  }
  await signIn("resend", { email, redirectTo: "/" });
  return { error: null };
}
