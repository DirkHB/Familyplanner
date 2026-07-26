import "server-only";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto/envelope";
import { createICloudClient } from "./tsdav-client";

/** iCloud-Konto verbinden: Zugang prüfen (Discovery), verschlüsselt speichern, Kalender anlegen. */
export async function connectICloudAccount(
  userId: string,
  username: string,
  appPassword: string,
) {
  // Zugang verifizieren, indem wir die Kalenderliste holen (wirft bei falschen Daten).
  const client = await createICloudClient({ username, password: appPassword });
  const remoteCalendars = await client.discoverCalendars();

  const encrypted = encryptSecret(appPassword);

  const existing = await prisma.calendarAccount.findFirst({
    where: { userId, provider: "icloud" },
  });
  const account = existing
    ? await prisma.calendarAccount.update({
        where: { id: existing.id },
        data: { username, credentialsEncrypted: encrypted },
      })
    : await prisma.calendarAccount.create({
        data: { userId, provider: "icloud", username, credentialsEncrypted: encrypted },
      });

  for (const cal of remoteCalendars) {
    await prisma.calendar.upsert({
      where: { accountId_url: { accountId: account.id, url: cal.url } },
      create: {
        accountId: account.id,
        url: cal.url,
        name: cal.displayName,
        color: cal.color,
        ctag: cal.ctag,
        syncToken: cal.syncToken,
        isSynced: true,
      },
      update: { name: cal.displayName, color: cal.color },
    });
  }

  return remoteCalendars.length;
}

export async function setCalendarSynced(calendarId: string, isSynced: boolean) {
  await prisma.calendar.update({ where: { id: calendarId }, data: { isSynced } });
}

export async function disconnectICloudAccount(accountId: string) {
  await prisma.calendarAccount.delete({ where: { id: accountId } });
}
