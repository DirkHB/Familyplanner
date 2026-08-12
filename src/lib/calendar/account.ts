import "server-only";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto/envelope";
import { createICloudClient } from "./tsdav-client";
import { createIcsClient } from "./ics-client";
import { ICLOUD_PROVIDER, ICS_PROVIDER } from "./provider";

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
    where: { userId, provider: ICLOUD_PROVIDER },
  });
  const account = existing
    ? await prisma.calendarAccount.update({
        where: { id: existing.id },
        data: { username, credentialsEncrypted: encrypted },
      })
    : await prisma.calendarAccount.create({
        data: { userId, provider: ICLOUD_PROVIDER, username, credentialsEncrypted: encrypted },
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

/**
 * Einen fremden Kalender abonnieren.
 *
 * Für alles, was die App nicht selbst anbinden kann: Googles „geheime Adresse
 * im iCal-Format", Outlook, Nextcloud, der Kita-Kalender. Man bekommt die
 * Termine zu sehen — schreiben geht nicht, dafür ist ein Abonnement nicht
 * gemacht.
 *
 * Die Adresse wird verschlüsselt gespeichert wie ein Passwort, weil sie eines
 * ist: Wer sie hat, sieht den Kalender. Sie steht deshalb auch nirgends in der
 * Oberfläche noch einmal.
 *
 * Geprüft wird sofort, indem der Kalender einmal geholt wird. Eine Adresse,
 * die erst beim nächtlichen Abgleich als falsch auffällt, hat niemandem
 * geholfen.
 */
export async function abonniereKalender(userId: string, url: string, name: string) {
  const adresse = url.trim();
  const anzeigename = name.trim() || "Abonnierter Kalender";

  const client = await createIcsClient(adresse, anzeigename);
  // Wirft, wenn dahinter kein Kalender liegt — und genau das soll es.
  const termine = await client.fetchChanges(adresse);

  const konto = await prisma.calendarAccount.create({
    data: {
      userId,
      provider: ICS_PROVIDER,
      username: anzeigename,
      credentialsEncrypted: encryptSecret(adresse),
    },
  });

  /*
   * Die Adresse des Kalenders ist hier die Kennung des Kontos, nicht die
   * geheime Adresse selbst. Sonst stünde das Geheimnis unverschlüsselt in
   * einer zweiten Spalte — und Kalenderadressen tauchen in Fehlermeldungen
   * und Protokollen auf.
   */
  await prisma.calendar.create({
    data: {
      accountId: konto.id,
      url: `abo:${konto.id}`,
      name: anzeigename,
      isSynced: true,
    },
  });

  return { termine: termine.objects.length };
}
