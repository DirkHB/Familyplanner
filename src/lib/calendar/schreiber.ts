import { buildIcs } from "./ics-builder";
import { createICloudClient } from "./tsdav-client";
import { googleAnlegen, googleAendern, googleLoeschen } from "./google-client";
import { GOOGLE_PROVIDER, ICLOUD_PROVIDER } from "./provider";

/**
 * Wer einen Termin in einen Kalender schreibt.
 *
 * Bis eben stand an fünf Stellen im Code dieselbe Annahme: „ein Kalender ist
 * iCloud". Anlegen, Ändern, Löschen und zweimal die Betreuungsblöcke bauten
 * sich jeweils selbst einen CalDAV-Zugang. Solange es nur einen Anbieter gab,
 * fiel das nicht auf — beim zweiten wäre es fünfmal derselbe Sonderfall
 * geworden.
 *
 * Deshalb dieses Interface. Es kennt drei Handlungen und keine Technik. Was
 * dahinter liegt, ist die einzige Stelle, die den Unterschied kennt:
 *
 * - **iCloud** spricht CalDAV. Der Termin ist eine .ics-Datei unter einer
 *   Adresse; geändert wird sie mit If-Match auf dem ETag.
 * - **Google** spricht JSON. Der Termin ist ein Objekt unter einer Kennung;
 *   gelesen wird er trotzdem über den .ics-Feed, wie ein Abonnement.
 *
 * Was oben herauskommt, ist in beiden Fällen dasselbe: die Felder, die in
 * unserer Event-Zeile stehen müssen.
 */

/** Die Felder eines Termins, wie die App sie kennt. */
export type SchreibFelder = {
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string | null;
  description?: string | null;
  /** Eigene Merkmale in der .ics — heute nur die Marke am Betreuungsblock. */
  xProps?: Record<string, string>;
};

/** Was lokal über einen Termin bekannt ist, bevor er geändert oder gelöscht wird. */
export type Bekannt = {
  uid: string;
  href: string;
  etag: string | null;
  rawIcs: string;
  providerEventId: string | null;
};

/** Was nach dem Schreiben in der Event-Zeile stehen muss. */
export type Geschrieben = {
  href: string;
  etag: string | null;
  rawIcs: string;
  providerEventId: string | null;
};

export interface KalenderSchreiber {
  anlegen(uid: string, felder: SchreibFelder): Promise<Geschrieben>;
  /** Ändert nur die übergebenen Felder. Alles andere am Termin bleibt stehen. */
  aendern(bekannt: Bekannt, felder: SchreibFelder): Promise<Geschrieben>;
  loeschen(bekannt: Bekannt): Promise<void>;
}

/** Das Ziel: welcher Kalender, bei welchem Anbieter, mit welchem Zugang. */
export type Schreibziel = {
  provider: string;
  /** Bei iCloud die Sammlungsadresse, bei Google `google:<kalender-id>`. */
  calendarUrl: string;
  username: string;
  /** Bei iCloud das App-Passwort, bei Google die Feed-Adresse (zum Lesen). */
  password: string;
};

export class UnbekannterAnbieterError extends Error {
  constructor(provider: string) {
    super(`In einen Kalender vom Typ „${provider}" kann die App nicht schreiben.`);
    this.name = "UnbekannterAnbieterError";
  }
}

/* -------------------------------- iCloud -------------------------------- */

function icloudSchreiber(ziel: Schreibziel): KalenderSchreiber {
  const client = () => createICloudClient({ username: ziel.username, password: ziel.password });
  const hrefFuer = (uid: string) => ziel.calendarUrl.replace(/\/$/, "") + "/" + uid + ".ics";

  return {
    async anlegen(uid, felder) {
      const ics = buildIcs({ uid, ...felder, location: felder.location ?? null });
      const href = hrefFuer(uid);
      const put = await (await client()).putEvent(ziel.calendarUrl, href, ics, null);
      return { href, etag: put.etag, rawIcs: ics, providerEventId: null };
    },

    async aendern(bekannt, felder) {
      /*
       * Neu gebaut statt am Vorhandenen operiert — das ist der Weg der
       * Betreuungsblöcke, die die App vollständig selbst besitzt. Termine von
       * Menschen gehen einen anderen Weg (update.ts), weil dort Alarme,
       * Teilnehmer und Serienregeln erhalten bleiben müssen.
       */
      const ics = buildIcs({ uid: bekannt.uid, ...felder, location: felder.location ?? null });
      const href = bekannt.href || hrefFuer(bekannt.uid);
      const put = await (await client()).putEvent(ziel.calendarUrl, href, ics, bekannt.etag);
      return { href, etag: put.etag, rawIcs: ics, providerEventId: null };
    },

    async loeschen(bekannt) {
      await (await client()).deleteEvent(bekannt.href, bekannt.etag ?? "");
    },
  };
}

/* -------------------------------- Google --------------------------------- */

/** Aus `google:johanna@gmail.com` die Kalender-ID. */
export function kalenderIdAus(url: string): string {
  return url.startsWith(`${GOOGLE_PROVIDER}:`) ? url.slice(GOOGLE_PROVIDER.length + 1) : url;
}

function googleSchreiber(ziel: Schreibziel): KalenderSchreiber {
  const kalenderId = kalenderIdAus(ziel.calendarUrl);
  const konto = { provider: ziel.provider };

  /*
   * Die .ics wird auch hier gebaut, obwohl Google sie nicht bekommt.
   *
   * Der Grund steht in unserer eigenen Datenbank: Die Event-Zeile trägt
   * `rawIcs`, und der Rest der App liest daraus — die Wochenansicht rechnet
   * Vorkommen aus, die Kopfdaten kommen aus dem Vorkommen und nicht aus der
   * Spalte. Ohne .ics stünde ein frisch angelegter Google-Termin so lange
   * halb da, bis der Feed ihn zurückbringt.
   *
   * Beim nächsten Abgleich ersetzt Googles eigene Fassung diese hier. Bis
   * dahin ist sie die Wahrheit, und sie stimmt: Sie ist aus denselben Feldern
   * gebaut, die eben abgeschickt wurden.
   */
  const alsIcs = (uid: string, felder: SchreibFelder) =>
    buildIcs({ uid, ...felder, location: felder.location ?? null });

  return {
    async anlegen(uid, felder) {
      const { id } = await googleAnlegen(konto, kalenderId, uid, felder);
      return {
        // Ein Google-Kalender wird über seinen Feed gelesen, und dort ist die
        // UID der einzige Schlüssel, der zwei Läufe überdauert. Der href muss
        // deshalb dasselbe sagen wie der des Feed-Stücks — sonst legt der
        // nächste Abgleich denselben Termin ein zweites Mal an.
        href: uid,
        // Der Abdruck des Feed-Stücks ist noch unbekannt. Leer heißt: Beim
        // nächsten Abgleich einmal auffrischen. Das ist billig und richtig.
        etag: null,
        rawIcs: alsIcs(uid, felder),
        providerEventId: id,
      };
    },

    async aendern(bekannt, felder) {
      if (!bekannt.providerEventId) {
        throw new Error("Zu diesem Termin fehlt Googles Kennung — er lässt sich nicht ändern.");
      }
      await googleAendern(konto, kalenderId, bekannt.providerEventId, felder);
      return {
        href: bekannt.href || bekannt.uid,
        etag: null,
        rawIcs: alsIcs(bekannt.uid, felder),
        providerEventId: bekannt.providerEventId,
      };
    },

    async loeschen(bekannt) {
      if (!bekannt.providerEventId) {
        throw new Error("Zu diesem Termin fehlt Googles Kennung — er lässt sich nicht löschen.");
      }
      await googleLoeschen(konto, kalenderId, bekannt.providerEventId);
    },
  };
}

/* --------------------------------- Wahl ---------------------------------- */

export function schreiberFuer(ziel: Schreibziel): KalenderSchreiber {
  if (ziel.provider === ICLOUD_PROVIDER) return icloudSchreiber(ziel);
  if (ziel.provider === GOOGLE_PROVIDER) return googleSchreiber(ziel);
  // Ein Abonnement landet hier. Das ist kein Versehen, sondern die Antwort:
  // Es hat keinen Rückweg, und so zu tun als ob wäre schlimmer als abzulehnen.
  throw new UnbekannterAnbieterError(ziel.provider);
}
