import "server-only";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto/envelope";
import { createICloudClient } from "./tsdav-client";
import { createIcsClient } from "./ics-client";
import { GOOGLE_PROVIDER, ICLOUD_PROVIDER, ICS_PROVIDER } from "./provider";
import { pruefeGoogleKalender } from "./google-client";

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

/**
 * Einen Google-Kalender verbinden.
 *
 * Anders als ein Abonnement ist das kein Einbahnweg: Gelesen wird über die
 * geheime .ics-Adresse, geschrieben über Googles Kalender-API. Die Person
 * bekommt damit ein echtes Schreibziel — ihre Termine und ihre
 * Betreuungsblöcke landen in ihrem eigenen Kalender, nicht im Kalender des
 * Partners.
 *
 * Beides wird sofort ausprobiert, bevor irgendetwas gespeichert wird. Der
 * Weg dorthin hat acht Handgriffe in Googles Oberfläche; wenn davon einer
 * schiefging, soll man es jetzt erfahren und nicht in drei Tagen an einem
 * Termin, der still nicht ankommt.
 */
export async function verbindeGoogleKalender(
  userId: string,
  kalenderId: string,
  feedUrl: string,
  name: string,
) {
  const id = kalenderId.trim();
  const adresse = feedUrl.trim();
  const anzeigename = name.trim() || id;

  // Erst schreiben — das ist die Frage, an der es hängt.
  const pruefung = await pruefeGoogleKalender({ provider: GOOGLE_PROVIDER }, id);
  if (!pruefung.ok) throw new Error(pruefung.grund);

  // Dann lesen. Eine falsche Feed-Adresse fiele sonst erst beim Abgleich auf,
  // und der Kalender bliebe stumm, obwohl das Verbinden „geklappt" hat.
  const client = await createIcsClient(adresse, anzeigename);
  const gelesen = await client.fetchChanges(adresse);

  const konto = await prisma.calendarAccount.create({
    data: {
      userId,
      provider: GOOGLE_PROVIDER,
      username: anzeigename,
      // Die geheime Adresse ist ein Passwort: Wer sie hat, sieht den Kalender.
      credentialsEncrypted: encryptSecret(adresse),
    },
  });

  await prisma.calendar.create({
    data: {
      accountId: konto.id,
      // Die Kalender-ID ist kein Geheimnis (meist eine E-Mail-Adresse) und
      // steht deshalb offen da — im Gegensatz zur Feed-Adresse daneben.
      url: `${GOOGLE_PROVIDER}:${id}`,
      name: pruefung.name || anzeigename,
      isSynced: true,
    },
  });

  return { termine: gelesen.objects.length, name: pruefung.name || anzeigename };
}
