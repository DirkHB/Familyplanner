import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { prismaRoh } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { isAllowedEmail } from "@/lib/auth/allowlist";
import { sendEmail } from "@/lib/email/send";
import { magicLinkEmail } from "@/lib/email/templates";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
    /*
   * Bewusst der Zugang OHNE Riegel: Der Adapter sucht eine Adresse, bevor
   * irgendein Haushalt feststeht, und legt beim ersten Anmelden die
   * Nutzerzeile an. Mit Riegel würde er sich selbst blockieren — er ist die
   * Stelle, die den Haushalt überhaupt erst herausfindet.
   */
  adapter: PrismaAdapter(prismaRoh),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY ?? "re_placeholder",
      from: process.env.EMAIL_FROM ?? "Familienplaner <plan@planyourweek.app>",
      // Kein Versand an fremde Adressen: Allowlist-Schutz VOR dem Senden.
      async sendVerificationRequest({ identifier, url }) {
        if (!isAllowedEmail(identifier)) {
          throw new Error("Diese Adresse ist nicht freigeschaltet.");
        }
        const { subject, html, text } = magicLinkEmail(identifier, url);
        await sendEmail({ to: identifier, subject, html, text });
      },
    }),
  ],
});
