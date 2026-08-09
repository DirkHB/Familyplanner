import NextAuth from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { prismaRoh } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { darfSichAnmelden, loeseEin } from "@/lib/einladung/store";
import { notnameAusEmail } from "@/lib/auth/allowlist";
import { PLATZ_A } from "@/lib/haushalt/platz";
import { sendEmail } from "@/lib/email/send";
import { magicLinkEmail } from "@/lib/email/templates";

/*
 * Bewusst der Zugang OHNE Riegel: Der Adapter sucht eine Adresse, bevor
 * irgendein Haushalt feststeht, und legt beim ersten Anmelden die Nutzerzeile
 * an. Mit Riegel würde er sich selbst blockieren — er ist die Stelle, die den
 * Haushalt überhaupt erst herausfindet.
 */
const basis = PrismaAdapter(prismaRoh) as Adapter;

/**
 * Der Moment, in dem aus einer Einladung ein Haushalt wird.
 *
 * Der mitgelieferte Adapter legt einfach eine Nutzerzeile an. Das geht hier
 * nicht: Jede Zeile braucht einen Haushalt, und beim allerersten Anmelden gibt
 * es noch keinen. Also wird die Einladung genau hier eingelöst — sie sagt, ob
 * jemand zu einer bestehenden Wohnung dazukommt oder eine eigene bezieht.
 *
 * Ohne offene Einladung endet es hier mit einer Ausnahme. Das ist die Stelle,
 * an der „nur auf Einladung" wirklich hängt: nicht an einer Liste, die jemand
 * pflegt, sondern daran, dass ohne Einladung keine Zeile entstehen kann.
 */
const adapter: Adapter = {
  ...basis,
  async createUser(user) {
    const email = (user.email ?? "").trim().toLowerCase();
    const eingeloest = await loeseEin(email);
    if (!eingeloest) {
      throw new Error("Für diese Adresse liegt keine gültige Einladung vor.");
    }

    const angelegt = await prismaRoh.user.create({
      data: {
        householdId: eingeloest.householdId,
        email,
        emailVerified: user.emailVerified ?? null,
        name: user.name ?? notnameAusEmail(email),
        image: user.image ?? null,
        // Wer eine eigene Wohnung bezieht, ist dort der Erste — Platz A. Wer
        // dazukommt, bekommt seinen Platz beim ersten Blick ins Profil.
        slot: eingeloest.neuerHaushalt ? PLATZ_A : null,
      },
    });
    return angelegt as AdapterUser;
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter,
  callbacks: {
    ...authConfig.callbacks,
    /**
     * Zwei Wege hinein, und nur diese zwei: Man wohnt schon hier, oder man ist
     * gerade eingeladen. Die Prüfung steht hier und nicht in auth.config, weil
     * sie die Datenbank fragt — und auth.config läuft auch in der Middleware,
     * am Rand, wo es keine Datenbank gibt.
     */
    async signIn({ user }) {
      return darfSichAnmelden(user?.email);
    },
  },
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY ?? "re_placeholder",
      from: process.env.EMAIL_FROM ?? "Familienplaner <plan@planyourweek.app>",
      // Kein Versand an fremde Adressen: geprüft VOR dem Senden, damit eine
      // fremde Adresse nicht einmal eine Mail von uns sieht.
      async sendVerificationRequest({ identifier, url }) {
        if (!(await darfSichAnmelden(identifier))) {
          throw new Error("Diese Adresse ist nicht eingeladen.");
        }
        const { subject, html, text } = magicLinkEmail(identifier, url);
        await sendEmail({ to: identifier, subject, html, text });
      },
    }),
  ],
});
