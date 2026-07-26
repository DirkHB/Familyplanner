/** CalDAV-Zugriff hinter einem Interface — lokal gegen Fakes testbar, ohne echten iCloud-Zugang. */

export type RemoteCalendar = {
  url: string;
  displayName: string;
  ctag: string | null;
  syncToken: string | null;
  color: string | null;
};

export type RemoteObject = {
  href: string;
  etag: string;
  ics: string;
};

export type FetchChangesResult = {
  objects: RemoteObject[];
  newSyncToken: string | null;
  ctag: string | null;
};

export type PutResult = { href: string; etag: string };

/**
 * Abstraktion über iCloud-CalDAV. Die echte Implementierung nutzt tsdav
 * (siehe tsdav-client.ts); Tests nutzen einen In-Memory-Fake.
 */
export interface CalDavClient {
  /** Principal → Kalenderliste. */
  discoverCalendars(): Promise<RemoteCalendar[]>;

  /**
   * Änderungen holen. Wenn ein syncToken übergeben wird, per sync-collection (RFC 6578),
   * sonst voller Abgleich (CTag/ETag). Liefert geänderte/neue Objekte inkl. roher .ics.
   */
  fetchChanges(
    calendarUrl: string,
    syncToken?: string | null,
  ): Promise<FetchChangesResult>;

  /** Änderung zurückschreiben (PUT mit If-Match auf das bekannte ETag). */
  putEvent(
    calendarUrl: string,
    href: string,
    ics: string,
    ifMatchEtag?: string | null,
  ): Promise<PutResult>;

  /** Löschen (mit If-Match). */
  deleteEvent(href: string, ifMatchEtag: string): Promise<void>;
}

/** Bei 412 (ETag-Konflikt) geworfen, damit der Sync neu laden/mergen kann. */
export class EtagConflictError extends Error {
  constructor(public href: string) {
    super(`ETag-Konflikt bei ${href} (412) — neu laden und mergen.`);
    this.name = "EtagConflictError";
  }
}
