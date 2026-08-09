import { PrismaClient } from "@prisma/client";
import { istUeberAlleHaushalte } from "@/lib/haushalt/kontext";
import { aktuellerHaushalt } from "@/lib/haushalt/aktuell";
import {
  MANDANTEN_MODELLE,
  LESEND,
  SCHREIBEND,
  mitFilter,
  mitHaushaltsDaten,
  gehoertDazu,
} from "@/lib/haushalt/riegel";

/**
 * Zwei Zugänge zur Datenbank: einer mit Riegel, einer ohne.
 *
 * `prisma` ist der mit Riegel und der, den die App benutzt. Er setzt bei jeder
 * Abfrage auf eine Mandanten-Tabelle den Haushalt ein — in die Bedingung beim
 * Lesen, in die Daten beim Schreiben. Wer den Haushalt vergisst, bekommt ihn
 * trotzdem; wer keinen Haushalt hat, bekommt eine Ausnahme statt aller Daten.
 *
 * `prismaRoh` ist der ohne. Ihn benutzen genau zwei Stellen: der Adapter der
 * Anmeldung (er sucht Adressen, bevor ein Haushalt feststeht) und das Einlösen
 * einer Einladung. Beide sind einzeln geprüft.
 *
 * Warum einsetzen statt verlangen: Ein Riegel, der bei fehlendem Filter nur
 * abbricht, hätte rund zweihundert Abfragen einzeln nachzuziehen — und jede
 * übersehene wäre bis zum ersten echten Nutzer unsichtbar. Einsetzen ist
 * sicher, sobald der Kontext stimmt, und der Kontext ist eine einzige Stelle.
 */

const globalForPrisma = globalThis as unknown as {
  prismaRoh?: PrismaClient;
};

function neuerClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prismaRoh = globalForPrisma.prismaRoh ?? neuerClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prismaRoh = prismaRoh;

export const prisma = prismaRoh.$extends({
  name: "haushalts-riegel",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (istUeberAlleHaushalte() || !MANDANTEN_MODELLE.has(model)) {
          return query(args);
        }

        const householdId = await aktuellerHaushalt(`${model}.${operation}`);
        const a = args as Record<string, unknown>;

        /*
         * `findUnique` und `delete`/`update` über einen eindeutigen Schlüssel
         * lassen in `where` nur eindeutige Felder zu — der Haushalt darf dort
         * nicht hinein. Bei diesen Abfragen wird deshalb hinterher geprüft:
         * Eine Zeile aus einem fremden Haushalt wird nicht ausgeliefert.
         */
        const nurEindeutig = operation === "findUnique" || operation === "findUniqueOrThrow";

        if (LESEND.has(operation) && !nurEindeutig) {
          a.where = mitFilter(a.where, householdId);
        }

        if (SCHREIBEND.has(operation)) {
          if (operation === "create" || operation === "createMany" || operation === "createManyAndReturn") {
            a.data = mitHaushaltsDaten(a.data, householdId);
          } else if (operation === "upsert") {
            a.create = mitHaushaltsDaten(a.create, householdId);
            // `where` bleibt unangetastet: upsert verlangt dort einen
            // eindeutigen Schlüssel. Die Zugehörigkeit sichert die create-Seite
            // und der Fremdschlüssel auf households.
          } else if (operation === "updateMany" || operation === "deleteMany") {
            a.where = mitFilter(a.where, householdId);
          }
          // `update` und `delete` gehen über einen eindeutigen Schlüssel —
          // die werden gleich unten vorab geprüft.
        }

        /*
         * Schreiben über einen eindeutigen Schlüssel muss VORHER geprüft
         * werden. Die erste Fassung prüfte am Ergebnis — da war die fremde
         * Zeile längst geändert, und die Ausnahme kam zu spät. Ein Riegel, der
         * nach dem Einbruch zuschlägt, ist keiner.
         */
        if (operation === "update" || operation === "delete" || operation === "upsert") {
          const treffer = await zeileImHaushalt(model, a.where, householdId);
          if (treffer === "fremd") {
            throw new Error(`${model}.${operation}: Zeile gehört einem anderen Haushalt.`);
          }
        }

        const ergebnis = await query(a);

        // Lesen über einen eindeutigen Schlüssel: Der Haushalt darf nicht in
        // die Bedingung (Prisma lässt dort nur eindeutige Felder zu), also
        // wird am Ergebnis geprüft. Das genügt, weil dabei nichts verändert
        // wurde — beim Schreiben reicht es nicht, siehe oben.
        if (nurEindeutig && !gehoertDazu(ergebnis, householdId)) {
          if (operation === "findUnique") return null;
          throw new Error(`${model}.${operation}: Zeile gehört einem anderen Haushalt.`);
        }

        return ergebnis;
      },
    },
  },
});

/**
 * Gibt es die Zeile — und wem gehört sie?
 *
 * Läuft bewusst über den Zugang ohne Riegel: Der Riegel fragt hier gerade
 * selbst, und eine Abfrage, die sich selbst aufruft, käme nie zurück.
 *
 * „fehlt" ist kein Fehler: Bei `upsert` heißt es, dass angelegt wird, und bei
 * `update` auf eine nicht vorhandene Zeile soll Prisma seine eigene, deutlich
 * bessere Fehlermeldung geben.
 */
async function zeileImHaushalt(
  model: string,
  where: unknown,
  householdId: string,
): Promise<"eigen" | "fremd" | "fehlt"> {
  const schluessel = model.charAt(0).toLowerCase() + model.slice(1);
  const tabelle = (prismaRoh as unknown as Record<string, { findFirst: (a: unknown) => Promise<unknown> }>)[
    schluessel
  ];
  if (!tabelle) return "fehlt";
  const zeile = (await tabelle
    .findFirst({ where, select: { householdId: true } })
    .catch(() => null)) as { householdId?: string } | null;
  if (!zeile) return "fehlt";
  return zeile.householdId === householdId ? "eigen" : "fremd";
}

export type PrismaMitRiegel = typeof prisma;
