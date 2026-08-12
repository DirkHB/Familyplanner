import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./SettingsClient";
import { diagnoseCalendars } from "@/lib/calendar/diagnose";
import { listDismissed } from "@/lib/care/rules";
import { getFlag, CARE_BLOCKS } from "@/lib/settings/store";
import { listTodoLists, countOpenPerList } from "@/lib/todos/lists";
import { listStores } from "@/lib/shopping/repository";
import { notnameAusEmail } from "@/lib/auth/allowlist";
import { mergePrefs } from "@/lib/push/quiet-hours";
import { haushaltProfil } from "@/lib/haushalt/profil";

export const dynamic = "force-dynamic";

const relFmt = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

export default async function EinstellungenPage() {
  const session = await auth();
  const userId = session?.user?.id;

  const ich = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: {
          tagVonStunde: true,
          tagBisStunde: true,
          notificationPrefs: true,
          schreibKalenderId: true,
          isAdmin: true,
        },
      })
    : null;
  const prefs = mergePrefs(ich?.notificationPrefs);
  const profil = await haushaltProfil();

  // Wer noch fehlt: Ist der Haushalt erst zu einem besetzt, gehört das
  // Einladen hierher — der Assistent ist nach dem Abschließen von nirgends
  // mehr verlinkt.
  const { offeneEinladungenDesHaushalts } = await import("@/lib/einladung/store");
  const offeneEinladung = session?.user?.householdId
    ? ((await offeneEinladungenDesHaushalts(session.user.householdId))[0]?.email ?? null)
    : null;

  const account = userId
    ? await prisma.calendarAccount.findFirst({
        where: { userId, provider: "icloud" },
        include: { calendars: { orderBy: { name: "asc" } } },
      })
    : null;

  const vm = account
    ? {
        id: account.id,
        username: account.username ?? "iCloud",
        // Welcher Kalender das Schreibziel ist. Leer heißt: noch nicht
        // festgelegt, die App nimmt den erstbesten.
        schreibKalenderId: ich?.schreibKalenderId ?? null,
        calendars: account.calendars.map((c) => ({
          id: c.id,
          name: c.name,
          isSynced: c.isSynced,
          lastSyncedLabel: c.lastSyncedAt ? relFmt.format(c.lastSyncedAt) : null,
          lastSyncOk: c.lastSyncOk,
          lastError: c.lastError,
        })),
      }
    : null;

  // Was steht in den Terminen? Entscheidet, ob wir die Zuordnung „wer ist
  // gebunden?" von Hand pflegen müssen oder ob sie schon in den Daten steckt.
  /**
   * Kein eigenes Konto heißt nicht „kein Kalender": Die App schreibt über den
   * Zugang des Haushalts. Ohne diesen Hinweis stünde hier „Nicht verbunden",
   * während das Anlegen von Terminen längst funktioniert.
   */
  const fremdeVerbindung =
    !account && userId
      ? await prisma.calendarAccount.findFirst({
          where: { provider: "icloud" },
          select: { username: true, user: { select: { name: true, email: true } } },
        })
      : null;

  // Abonnierte Kalender stehen neben der iCloud-Verbindung, nicht darin: Sie
  // gehören niemandem im Haushalt, sie werden nur gelesen.
  const { ICS_PROVIDER, GOOGLE_PROVIDER, ICLOUD_PROVIDER } = await import(
    "@/lib/calendar/provider",
  );
  const { dienstkontoAdresse } = await import("@/lib/calendar/google-auth");
  const [abos, googles] = userId
    ? await Promise.all([
        prisma.calendarAccount.findMany({
          where: { provider: ICS_PROVIDER },
          orderBy: { createdAt: "asc" },
          select: { id: true, username: true },
        }),
        prisma.calendarAccount.findMany({
          where: { provider: GOOGLE_PROVIDER },
          orderBy: { createdAt: "asc" },
          select: { id: true, username: true },
        }),
      ])
    : [[], []];

  /*
   * Alles, worein diese Person schreiben kann — über alle Anbieter hinweg.
   * Die Wahl „Neue Termine landen in" hing bis eben am iCloud-Konto und hätte
   * einen verbundenen Google-Kalender gar nicht erst angeboten.
   */
  const schreibZiele = userId
    ? await prisma.calendar.findMany({
        where: {
          isSynced: true,
          account: { userId, provider: { in: [ICLOUD_PROVIDER, GOOGLE_PROVIDER] } },
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true, account: { select: { provider: true } } },
      })
    : [];

  const [diagnose, abgewinkt] = userId
    ? await Promise.all([diagnoseCalendars(), listDismissed()])
    : [[], []];
  const careBlocks = await getFlag(CARE_BLOCKS);

  // Die Zahlen an den Fächern sind kein Schmuck: Sie beantworten die Frage,
  // die beim Löschen zählt — steckt da noch etwas drin?
  const [todoListen, offenProListe, laeden, artikelProLaden] = await Promise.all([
    listTodoLists(),
    countOpenPerList(),
    listStores(),
    prisma.shoppingItem.groupBy({ by: ["storeId"], _count: { _all: true } }),
  ]);
  const artikelZahl = new Map(artikelProLaden.map((r) => [r.storeId, r._count._all]));

  return (
    <SettingsClient
      account={vm}
      diagnose={diagnose}
      abgewinkt={abgewinkt.map((r) => r.titleKey)}
      careBlocks={careBlocks}
      todoLists={todoListen.map((l) => ({
        id: l.id,
        name: l.name,
        anzahl: offenProListe.get(l.id) ?? 0,
      }))}
      stores={laeden.map((s) => ({
        id: s.id,
        name: s.name,
        anzahl: artikelZahl.get(s.id) ?? 0,
      }))}
      tagVon={ich?.tagVonStunde ?? null}
      tagBis={ich?.tagBisStunde ?? null}
      pushPrefs={{ requests: prefs.requests, taskWindow: prefs.taskWindow }}
      istVerwaltung={ich?.isAdmin ?? false}
      abos={abos.map((a) => ({ id: a.id, name: a.username ?? "Abonnement" }))}
      googles={googles.map((a) => ({ id: a.id, name: a.username ?? "Google-Kalender" }))}
      dienstadresse={dienstkontoAdresse()}
      schreibZiele={schreibZiele.map((c) => ({
        id: c.id,
        name: c.name,
        provider: c.account.provider,
      }))}
      schreibKalenderId={ich?.schreibKalenderId ?? null}
      partner={{ schonZuZweit: profil.erwachsene.length >= 2, eingeladen: offeneEinladung }}
      haushalt={{
        erwachsene: profil.erwachsene.map((e) => ({ email: e.email, name: e.name })),
        kind: profil.kind,
      }}
      fremdeVerbindung={
        fremdeVerbindung
          ? {
              name:
                fremdeVerbindung.user?.name ??
                notnameAusEmail(fremdeVerbindung.user?.email ?? ""),
            }
          : null
      }
    />
  );
}
