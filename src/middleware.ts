import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-Middleware nutzt nur die JWT-Session (kein Prisma) für den Route-Schutz.
export const { auth: middleware } = NextAuth(authConfig);

export default middleware(() => {
  // Der `authorized`-Callback in auth.config.ts entscheidet über Zugang/Redirect.
});

export const config = {
  // Alles schützen außer: Auth-API, Healthcheck, Next-Assets, PWA-Dateien, Bilder.
  // Der Healthcheck muss ohne Session durchkommen, sonst antwortet Sliplane
  // ein Redirect statt 200 und der Service gilt als ungesund.
  matcher: [
    "/((?!api/auth|api/health|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/).*)",
  ],
};
