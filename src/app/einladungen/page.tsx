import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prismaRoh } from "@/lib/prisma";
import { EinladungenClient } from "./EinladungenClient";
import { abtippen } from "@/lib/einladung/abtippen";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Berlin",
});

/**
 * Einladungen — die Seite, die es sonst nicht bräuchte.
 *
 * Sie existiert für genau eine Aufgabe: einer befreundeten Familie einen Link
 * schicken, mit dem sie sich selbst einrichtet. Ohne sie hieße jede neue
 * Familie eine halbe Stunde Handarbeit an der Datenbank und den
 * Umgebungsvariablen — und niemand macht das siebenmal.
 *
 * Die Abfragen laufen über den Zugang ohne Riegel, weil sie ihrer Natur nach
 * über alle Haushalte gehen. Deshalb steht die Berechtigung ganz oben und
 * nicht irgendwo in der Mitte.
 */
export default async function EinladungenPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/anmelden");

  const ich = await prismaRoh.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!ich?.isAdmin) redirect("/");

  const jetzt = new Date();
  // Die Zahlen sind kein Schmuck: Sie beantworten die einzige Frage, die vor
  // dem Löschen zählt — steckt da noch etwas drin?
  const [offen, haushalte, termine, aufgaben] = await Promise.all([
    prismaRoh.invite.findMany({
      where: { usedAt: null, householdId: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, expiresAt: true },
    }),
    prismaRoh.household.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        createdAt: true,
        users: { orderBy: { createdAt: "asc" }, select: { email: true, name: true } },
      },
    }),
    prismaRoh.event.groupBy({ by: ["householdId"], _count: { _all: true } }),
    prismaRoh.todo.groupBy({ by: ["householdId"], _count: { _all: true } }),
  ]);

  const termineJe = new Map(termine.map((r) => [r.householdId, r._count._all]));
  const aufgabenJe = new Map(aufgaben.map((r) => [r.householdId, r._count._all]));

  return (
    <EinladungenClient
      offen={offen.map((e) => ({
        id: e.id,
        email: e.email,
        bis: fmt.format(e.expiresAt),
        abgelaufen: e.expiresAt.getTime() <= jetzt.getTime(),
      }))}
      haushalte={haushalte.map((h) => ({
        id: h.id,
        seit: fmt.format(h.createdAt),
        menschen: h.users.map((u) => u.name ?? u.email),
        termine: termineJe.get(h.id) ?? 0,
        aufgaben: aufgabenJe.get(h.id) ?? 0,
        abtippen: abtippen(h),
        // Der eigene Haushalt lässt sich hier nicht löschen — das nähme die
        // Sitzung mit, aus der die Berechtigung dafür kommt.
        eigener: h.id === session.user.householdId,
      }))}
    />
  );
}
