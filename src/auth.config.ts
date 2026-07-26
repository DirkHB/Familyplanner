import type { NextAuthConfig } from "next-auth";
import { isAllowedEmail, displayNameForEmail } from "@/lib/auth/allowlist";

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
      if (p.startsWith("/api/internal")) return true; // per Shared-Secret geschützt (Worker)
      if (p.startsWith("/vorschau")) return true; // öffentliche Design-Vorschau (Beispieldaten)
      if (PUBLIC.includes(p)) return true;
      return !!auth?.user;
    },
    // Nur die zwei freigeschalteten Adressen kommen rein.
    signIn({ user }) {
      return isAllowedEmail(user?.email);
    },
    jwt({ token }) {
      if (token.email && !token.name) {
        token.name = displayNameForEmail(token.email);
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub as string) ?? session.user.id;
        session.user.name = (token.name as string) ?? session.user.name;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
