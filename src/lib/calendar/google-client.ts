import { dienstkontoAdresse, zugangFuer, type KontoZugang } from "./google-auth";

/**
 * Schreiben in einen Google-Kalender.
 *
 * Nur das Schreiben — gelesen wird weiter über die .ics-Adresse, wie bei jedem
 * abonnierten Kalender. Das ist kein Kompromiss, sondern die kleinere Hälfte:
 * Der Feed liefert dieselben Einzelteile wie iCloud, und Dirks Test hat
 * gezeigt, dass ein frisch angelegter Termin darin sofort auftaucht — unter
 * derselben UID, die uns Google beim Anlegen nennt. Daran erkennt der Abgleich
 * unseren eigenen Termin wieder, statt ihn ein zweites Mal anzulegen.
 *
 * Googles API spricht JSON, unsere Kalenderschicht spricht .ics. Übersetzt
 * wird deshalb hier, an einer Stelle, und nicht verteilt über den Rest.
 */

const API = process.env.GOOGLE_API_BASE ?? "https://www.googleapis.com/calendar/v3";
const ZEITZONE = "Europe/Berlin";

/** Die Felder eines Termins, wie die App sie kennt — ohne .ics-Beiwerk. */
export type TerminFelder = {
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string | null;
  description?: string | null;
};

export class GoogleError extends Error {
  constructor(
    public status: number,
    grund: string,
  ) {
    super(grund);
    this.name = "GoogleError";
  }
}

async function ruf(
  token: string,
  pfad: string,
  optionen: RequestInit = {},
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${pfad}`, {
    ...optionen,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(optionen.headers ?? {}),
    },
  });
  if (res.status === 204) return {};
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new GoogleError(res.status, json?.error?.message ?? `HTTP ${res.status}`);
  }
  return json as Record<string, unknown>;
}

const kalenderPfad = (kalenderId: string) => `/calendars/${encodeURIComponent(kalenderId)}`;

/** Ein Datum als „2026-08-14" in Berliner Zeit — für Ganztagstermine. */
function tagesdatum(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: ZEITZONE }).format(d);
}

/**
 * Unsere Felder in Googles Form.
 *
 * Der Fallstrick sind die Ganztagstermine: Google will `date` statt
 * `dateTime`, und das Ende ist **ausschließlich** — ein eintägiger Termin am
 * 14. endet bei Google am 15. Unsere Daten halten das Ende so, wie iCal es
 * auch tut, nämlich ebenfalls ausschließlich; deshalb wird hier nur das
 * Format getauscht, nicht gerechnet.
 */
function alsGoogleTermin(f: Partial<TerminFelder>): Record<string, unknown> {
  const koerper: Record<string, unknown> = {};
  if (f.title !== undefined) koerper.summary = f.title;
  if (f.location !== undefined) koerper.location = f.location ?? null;
  if (f.description !== undefined) koerper.description = f.description ?? null;

  if (f.start && f.end) {
    koerper.start = f.allDay
      ? { date: tagesdatum(f.start) }
      : { dateTime: f.start.toISOString(), timeZone: ZEITZONE };
    koerper.end = f.allDay
      ? { date: tagesdatum(f.end) }
      : { dateTime: f.end.toISOString(), timeZone: ZEITZONE };
  }
  return koerper;
}

export type GoogleTermin = { id: string; uid: string };

/**
 * Einen Termin anlegen — mit **unserer** UID.
 *
 * Das ist der Grund für `import` statt `insert`: `insert` vergibt die UID
 * selbst, `import` nimmt eine mitgebrachte an. Der Unterschied klingt klein
 * und trägt alles Weitere.
 *
 * Ein Betreuungsblock hat eine selbst vergebene, wiedererkennbare UID. Daran
 * hängt, dass ein von Hand gelöschter Block nicht im nächsten Atemzug
 * zurückgeschrieben wird, und dass beim Löschen eines Termins die richtige
 * Betreuung mitgeht. Ließen wir Google die UID vergeben, bräuchte jede dieser
 * Stellen einen Sonderfall — und der Termin käme über den Feed unter einer
 * fremden Kennung zurück und läge doppelt da.
 *
 * Mit `import` bleibt das UID-Schema über alle Anbieter dasselbe, und der
 * Rest der App muss gar nicht wissen, wo ein Termin liegt.
 */
export async function googleAnlegen(
  konto: KontoZugang,
  kalenderId: string,
  uid: string,
  felder: TerminFelder,
): Promise<GoogleTermin> {
  const token = await zugangFuer(konto);
  const antwort = await ruf(token, `${kalenderPfad(kalenderId)}/events/import`, {
    method: "POST",
    body: JSON.stringify({ ...alsGoogleTermin(felder), iCalUID: uid }),
  });

  const id = String(antwort.id ?? "");
  const zurueck = String(antwort.iCalUID ?? "");
  if (!id) throw new GoogleError(0, "Google hat den Termin ohne Kennung zurückgegeben.");
  if (zurueck && zurueck !== uid) {
    // Sollte nicht vorkommen — aber lieber laut scheitern als still einen
    // Termin anlegen, den wir nie wiederfinden.
    throw new GoogleError(0, `Google hat die UID geändert: ${uid} wurde zu ${zurueck}.`);
  }
  return { id, uid };
}

/** Einen Termin ändern. `eventId` ist Googles Kennung, nicht die UID. */
export async function googleAendern(
  konto: KontoZugang,
  kalenderId: string,
  eventId: string,
  felder: Partial<TerminFelder>,
): Promise<void> {
  const token = await zugangFuer(konto);
  await ruf(
    token,
    `${kalenderPfad(kalenderId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
    { method: "PATCH", body: JSON.stringify(alsGoogleTermin(felder)) },
  );
}

/**
 * Einen Termin löschen.
 *
 * Ein 404 oder 410 heißt: Er ist dort schon weg. Das ist kein Fehler, sondern
 * das Ziel — genau wie beim iCloud-Weg, der einen 404 ebenfalls durchgehen
 * lässt, damit lokal trotzdem aufgeräumt wird.
 */
export async function googleLoeschen(
  konto: KontoZugang,
  kalenderId: string,
  eventId: string,
): Promise<void> {
  const token = await zugangFuer(konto);
  try {
    await ruf(token, `${kalenderPfad(kalenderId)}/events/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
    });
  } catch (err) {
    if (err instanceof GoogleError && (err.status === 404 || err.status === 410)) return;
    throw err;
  }
}

export type Pruefung =
  | { ok: true; name: string }
  | { ok: false; grund: string; nurLesend: boolean };

/**
 * Beim Verbinden: Kommen wir an den Kalender, und dürfen wir hineinschreiben?
 *
 * Beides wird wirklich ausprobiert. Googles API verrät einem Service Account
 * nirgends, welche Rechte er an einem geteilten Kalender hat — der taucht
 * nicht einmal in seiner Kalenderliste auf. Die einzige ehrliche Antwort ist
 * ein Hin und Zurück: anlegen, wieder löschen.
 *
 * Der Probetermin liegt im Jahr 2001, damit ihn niemand in einer aktuellen
 * Ansicht aufblitzen sieht, und ist eine Sekunde später wieder weg.
 *
 * Das kostet zwei Aufrufe beim Einrichten und erspart die Sorte Fehler, die
 * erst drei Tage später auffällt, wenn ein Termin still nicht ankommt.
 */
export async function pruefeGoogleKalender(
  konto: KontoZugang,
  kalenderId: string,
): Promise<Pruefung> {
  let token: string;
  try {
    token = await zugangFuer(konto);
  } catch (err) {
    return {
      ok: false,
      nurLesend: false,
      grund: err instanceof Error ? err.message : "Anmeldung bei Google fehlgeschlagen.",
    };
  }

  let name = "";
  try {
    const kalender = await ruf(token, kalenderPfad(kalenderId));
    name = String(kalender.summary ?? "");
  } catch (err) {
    const status = err instanceof GoogleError ? err.status : 0;
    return {
      ok: false,
      nurLesend: false,
      grund:
        status === 404
          ? /*
             * Beide Seiten benennen, nicht nur die Diagnose.
             *
             * „Die Freigabe ist nicht angekommen" hilft niemandem, der nicht
             * weiß, WELCHE Adresse freigegeben sein muss — und die ändert
             * sich, wenn das Dienstkonto wechselt. Genau daran scheitert ein
             * zweiter Versuch mit einer Freigabe aus dem ersten.
             */
            `Der Kalender „${kalenderId}" ist für ${dienstkontoAdresse() ?? "das Dienstkonto"} nicht erreichbar. Fast immer heißt das: Genau diese Adresse ist im Kalender nicht freigegeben — eine Freigabe an eine frühere Adresse zählt nicht. Sonst stimmt die Kalender-ID nicht.`
          : err instanceof Error
            ? err.message
            : "Unbekannter Fehler.",
    };
  }

  const probe = new Date("2001-01-01T09:00:00.000Z");
  // Mit einer eigenen UID — die Probe prüft genau den Mechanismus, auf dem
  // später alles steht, und nicht bloß „irgendein Schreibzugriff".
  const probeUid = `fp-probe-${Date.now()}@planyourweek.app`;
  let probeId: string;
  try {
    const angelegt = await googleAnlegen(konto, kalenderId, probeUid, {
      title: "Verbindungstest",
      start: probe,
      end: new Date(probe.getTime() + 3600_000),
      allDay: false,
    });
    probeId = angelegt.id;
  } catch (err) {
    const status = err instanceof GoogleError ? err.status : 0;
    return {
      ok: false,
      nurLesend: status === 403,
      grund:
        status === 403
          ? "Lesen geht, Schreiben nicht. Die Freigabe steht auf „Alle Termindetails sehen“ — sie muss auf „Änderungen an Terminen vornehmen“ stehen."
          : err instanceof Error
            ? err.message
            : "Unbekannter Fehler.",
    };
  }

  // Wegräumen. Bleibt er liegen, steht ein Termin von 2001 im Kalender —
  // unschön, aber kein Grund, die Verbindung abzulehnen.
  await googleLoeschen(konto, kalenderId, probeId).catch(() => null);

  return { ok: true, name: name || kalenderId };
}
