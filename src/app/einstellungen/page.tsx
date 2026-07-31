import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./SettingsClient";
import { diagnoseCalendars } from "@/lib/calendar/diagnose";
import { listDismissed } from "@/lib/care/rules";

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
  const [diagnose, abgewinkt] = userId
    ? await Promise.all([diagnoseCalendars(), listDismissed()])
    : [[], []];

  return (
    <SettingsClient
      account={vm}
      diagnose={diagnose}
      abgewinkt={abgewinkt.map((r) => r.titleKey)}
    />
  );
}
