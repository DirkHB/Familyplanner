import type { NextAuthConfig } from "next-auth";
import { notnameAusEmail } from "@/lib/auth/allowlist";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Edge-sichere Basis-Konfiguration (ohne Prisma-Adapter, ohne Provider-Secrets).
 * Wird von der Middleware genutzt. Der volle Auth-Setup (Adapter, Resend) liegt in auth.ts.
 */
export const authConfig = {
  session: { strategy: "jwt", maxAge: ONE_YEAR },
  trustHost: true,
  pages: {
    signIn: "/anmelden",
    verifyRequest: "/anmelden/gesendet",
    error: "/anmelden",
  },
  providers: [],
  callbacks: {
    // Route-Schutz. Öffentlich: Landing, Design-Referenz, Anmeldung.
    // Alles andere (die echte App) braucht Login.
    authorized({ auth, request: { nextUrl } }) {
      const p = nextUrl.pathname;
      const PUBLIC = ["/", "/style"];
      if (p.startsWith("/anmelden")) return true;
      if (p.startsWith("/einladung")) return true; // der Link aus der Mail, noch ohne Anmeldung
      if (p.startsWith("/api/internal")) return true; // per Shared-Secret geschützt (Worker)
      if (p === "/api/push/vapid-key") return true; // nur der öffentliche VAPID-Key
      if (p.startsWith("/vorschau")) return true; // öffentliche Design-Vorschau (Beispieldaten)
      if (PUBLIC.includes(p)) return true;
      return !!auth?.user;
    },
    // Wer hereindarf, entscheidet die Einladung — geprüft in auth.ts, weil es
    // dafür die Datenbank braucht. Hier am Rand gibt es keine.
    /*
     * Der Haushalt wird beim Anmelden einmal in das Token geschrieben und
     * bleibt dort. Ihn bei jeder Anfrage nachzuschlagen hieße, für jede
     * Datenbankabfrage vorher eine Datenbankabfrage zu machen — und der
     * Riegel ruft das bei jeder auf.
     *
     * Er ändert sich nie: Wer einmal zu einem Haushalt gehört, bleibt dort.
     */
    jwt({ token, user }) {
      if (token.email && !token.name) {
        token.name = notnameAusEmail(token.email);
      }
      const frisch = (user as { householdId?: string } | undefined)?.householdId;
      if (frisch) token.householdId = frisch;
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub as string) ?? session.user.id;
        session.user.name = (token.name as string) ?? session.user.name;
        session.user.householdId = (token.householdId as string) ?? "";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
