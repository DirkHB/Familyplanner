import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /**
       * Der Haushalt der angemeldeten Person.
       *
       * Steht in der Sitzung, weil ihn jede Datenbankabfrage braucht — der
       * Riegel in lib/prisma liest ihn von hier. Ohne ihn bricht jede Abfrage
       * ab, statt stillschweigend alle Haushalte zu sehen.
       */
      householdId: string;
    } & DefaultSession["user"];
  }
}
