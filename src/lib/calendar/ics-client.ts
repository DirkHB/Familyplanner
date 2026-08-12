import type {
  CalDavClient,
  RemoteCalendar,
  FetchChangesResult,
  PutResult,
} from "./caldav";
import { zerlegeFeed } from "./ics-feed";

/**
 * Ein abonnierter Kalender — nur lesen.
 *
 * Dahinter steht kein CalDAV-Server, sondern eine einzige Adresse, unter der
 * eine .ics-Datei liegt: bei Google die „geheime Adresse im iCal-Format", bei
 * Outlook, Nextcloud oder dem Vereinskalender heißt es anders und tut
 * dasselbe. Der Sync merkt davon nichts — er bekommt dieselben Einzelteile
 * wie von iCloud.
 *
 * Schreiben geht nicht, und das ist keine Lücke, sondern die Wahrheit: Ein
 * Abonnement ist eine Einbahnstraße. Die Schreibwege werfen deshalb hier eine
 * Ausnahme, statt so zu tun, als hätten sie funktioniert.
 */

/** Wie lange wir auf den Feed warten. Danach ist er für diesen Lauf kaputt. */
const GEDULD_MS = 20_000;

/** Mehr als das lädt niemand herunter — ein Kalender ist keine Mediathek. */
const MAX_BYTES = 8 * 1024 * 1024;

export class NurLesendError extends Error {
  constructor(was: string) {
    super(
      `${was} geht bei einem abonnierten Kalender nicht — er ist nur zum Lesen da.`,
    );
    this.name = "NurLesendError";
  }
}

export async function createIcsClient(feedUrl: string, name: string): Promise<CalDavClient> {
  return {
    /*
     * Ein Abonnement ist genau ein Kalender — es gibt nichts zu entdecken.
     * Die Adresse steht hier bewusst nicht drin: Sie ist das Geheimnis, und
     * Kalenderadressen landen in Fehlermeldungen und Protokollen. Die Zeile in
     * der Datenbank legt `abonniereKalender` selbst an.
     */
    async discoverCalendars(): Promise<RemoteCalendar[]> {
      return [
        {
          url: "abo",
          displayName: name,
          ctag: null,
          syncToken: null,
          color: null,
          components: ["VEVENT"],
        },
      ];
    },

    /*
     * Die übergebene Kalenderadresse wird nicht gebraucht — es gibt nur die
     * eine, und die steckt schon in diesem Zugang. Der Sync ruft trotzdem mit
     * ihr auf, weil er den Unterschied nicht kennen soll.
     */
    async fetchChanges(): Promise<FetchChangesResult> {
      const text = await ladeFeed(feedUrl);
      return {
        objects: zerlegeFeed(text).map((s) => ({
          // Ein Abonnement hat keine Adressen je Termin. Die UID ist der
          // einzige Schlüssel, der zwei Läufe überdauert — und genau dafür
          // braucht der Abgleich den href.
          href: s.uid,
          etag: s.etag,
          ics: s.ics,
        })),
        newSyncToken: null,
        ctag: null,
      };
    },

    async putEvent(): Promise<PutResult> {
      throw new NurLesendError("Schreiben");
    },

    async deleteEvent(): Promise<void> {
      throw new NurLesendError("Löschen");
    },

    async fetchTodoObjects() {
      // Erinnerungen kommen aus iCloud. Ein Abonnement liefert Termine, und
      // eine leere Liste ist hier die richtige Antwort — kein Fehler.
      return [];
    },
  };
}

/**
 * Die Datei holen.
 *
 * `webcal://` ist kein eigenes Protokoll, sondern `https://` mit anderem
 * Namen — Apple hat es erfunden, damit ein Klick im Browser den Kalender
 * öffnet. Wer die Adresse aus einer App kopiert, hat es oft davorstehen.
 */
async function ladeFeed(url: string): Promise<string> {
  const abbruch = AbortSignal.timeout(GEDULD_MS);
  const res = await fetch(url.replace(/^webcal:\/\//i, "https://"), {
    signal: abbruch,
    redirect: "follow",
    headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.5" },
  });

  if (!res.ok) {
    throw new Error(`Der Kalender antwortete mit ${res.status}.`);
  }

  const laenge = Number(res.headers.get("content-length") ?? 0);
  if (laenge > MAX_BYTES) {
    throw new Error("Der Kalender ist zu groß.");
  }

  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error("Der Kalender ist zu groß.");
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    // Der häufigste Fehler: Es wurde die Adresse der Web-Ansicht kopiert, nicht
    // die des Kalenders. Dann kommt eine HTML-Seite zurück.
    throw new Error("Darunter liegt kein Kalender, sondern etwas anderes.");
  }
  return text;
}
