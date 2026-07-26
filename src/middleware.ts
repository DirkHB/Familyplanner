import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-Middleware nutzt nur die JWT-Session (kein Prisma) für den Route-Schutz.
export const { auth: middleware } = NextAuth(authConfig);

export default middleware(() => {
  // Der `authorized`-Callback in auth.config.ts entscheidet über Zugang/Redirect.
});

export const config = {
  // Alles schützen außer: Auth-API, Next-Assets, PWA-Dateien, Bilder.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/).*)",
  ],
};
