import { createDAVClient } from "tsdav";
import {
  type CalDavClient,
  type RemoteCalendar,
  type FetchChangesResult,
  type PutResult,
  EtagConflictError,
} from "./caldav";

/**
 * Echte iCloud-CalDAV-Anbindung über tsdav. Wird mit den app-spezifischen Passwörtern
 * (verschlüsselt in der DB) instanziiert. Noch nicht gegen echtes iCloud verifiziert —
 * das passiert mit echten Zugängen (siehe SECRETS_NEEDED.md).
 */

const ICLOUD_URL = "https://caldav.icloud.com";

type Creds = { username: string; password: string };

export async function createICloudClient(creds: Creds): Promise<CalDavClient> {
  const client = await createDAVClient({
    serverUrl: ICLOUD_URL,
    credentials: { username: creds.username, password: creds.password },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });

  async function getCalendar(url: string) {
    const calendars = await client.fetchCalendars();
    const cal = calendars.find((c) => c.url === url);
    if (!cal) throw new Error(`Kalender nicht gefunden: ${url}`);
    return cal;
  }

  return {
    async discoverCalendars(): Promise<RemoteCalendar[]> {
      const calendars = await client.fetchCalendars();
      return calendars.map((c) => ({
        url: c.url,
        displayName:
          typeof c.displayName === "string" ? c.displayName : (c.url ?? "Kalender"),
        ctag: (c.ctag as string | undefined) ?? null,
        syncToken: (c.syncToken as string | undefined) ?? null,
        color: (c.calendarColor as string | undefined) ?? null,
      }));
    },

    async fetchChanges(calendarUrl: string): Promise<FetchChangesResult> {
      // Vollständiger CTag/ETag-Abgleich (zuverlässig). sync-collection-Optimierung folgt.
      const cal = await getCalendar(calendarUrl);
      const objects = await client.fetchCalendarObjects({ calendar: cal });
      return {
        objects: objects.map((o) => ({
          href: o.url,
          etag: (o.etag as string | undefined) ?? "",
          ics: (o.data as string | undefined) ?? "",
        })),
        newSyncToken: (cal.syncToken as string | undefined) ?? null,
        ctag: (cal.ctag as string | undefined) ?? null,
      };
    },

    async putEvent(
      calendarUrl: string,
      href: string,
      ics: string,
      ifMatchEtag?: string | null,
    ): Promise<PutResult> {
      let res: Response;
      if (ifMatchEtag) {
        res = await client.updateCalendarObject({
          calendarObject: { url: href, data: ics, etag: ifMatchEtag },
        });
      } else {
        res = await client.createCalendarObject({
          calendar: { url: calendarUrl } as never,
          filename: href.split("/").pop() || `${Date.now()}.ics`,
          iCalString: ics,
        });
      }
      if (res.status === 412) throw new EtagConflictError(href);
      if (!res.ok) throw new Error(`CalDAV-PUT fehlgeschlagen (${res.status}).`);
      return { href, etag: res.headers.get("etag") ?? "" };
    },

    async deleteEvent(href: string, ifMatchEtag: string): Promise<void> {
      const res = await client.deleteCalendarObject({
        calendarObject: { url: href, etag: ifMatchEtag },
      });
      if (res.status === 412) throw new EtagConflictError(href);
      if (!res.ok) throw new Error(`CalDAV-DELETE fehlgeschlagen (${res.status}).`);
    },
  };
}
