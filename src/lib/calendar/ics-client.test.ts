import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import { createIcsClient, NurLesendError } from "./ics-client";
import { expandOccurrences } from "./ical";

/**
 * Gegen einen Server, der sich verhält wie Googles „geheime Adresse im
 * iCal-Format": eine Datei, alle Termine darin, Zeitzone im Kopf, eine Serie
 * mit einer verschobenen Ausnahme.
 *
 * Der Server läuft im Test selbst — ohne ihn wäre das hier eine Prüfung, die
 * nur auf einem bestimmten Rechner grün ist.
 */

const FEED = [
  "BEGIN:VCALENDAR", "PRODID:-//Google Inc//Google Calendar 70.9054//EN",
  "VERSION:2.0", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
  "X-WR-CALNAME:Johanna", "X-WR-TIMEZONE:Europe/Berlin",
  "BEGIN:VTIMEZONE", "TZID:Europe/Berlin",
  "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST",
  "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
  "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET",
  "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
  "END:VTIMEZONE",
  "BEGIN:VEVENT", "DTSTART;TZID=Europe/Berlin:20260812T140000",
  "DTEND;TZID=Europe/Berlin:20260812T153000",
  "DTSTAMP:20260810T120000Z", "UID:joh-physio@google.com",
  "SUMMARY:Physiotherapie", "END:VEVENT",
  "BEGIN:VEVENT", "DTSTART;TZID=Europe/Berlin:20260813T100000",
  "DTEND;TZID=Europe/Berlin:20260813T110000",
  "RRULE:FREQ=WEEKLY;COUNT=4",
  "DTSTAMP:20260810T120000Z", "UID:joh-kurs@google.com",
  "SUMMARY:Rückbildungskurs", "END:VEVENT",
  "BEGIN:VEVENT", "DTSTART;TZID=Europe/Berlin:20260820T110000",
  "DTEND;TZID=Europe/Berlin:20260820T120000",
  "RECURRENCE-ID;TZID=Europe/Berlin:20260820T100000",
  "DTSTAMP:20260810T120000Z", "UID:joh-kurs@google.com",
  "SUMMARY:Rückbildung (eine Stunde später)", "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

let server: Server;
let basis = "";
/** Was der Server gerade ausliefert — veränderbar, damit sich der Abdruck ändern kann. */
let ausgeliefert = FEED;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url?.includes("/html")) {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end("<html><body>Anmeldeseite</body></html>");
    }
    if (req.url?.includes("/weg")) {
      res.writeHead(404);
      return res.end("nope");
    }
    res.writeHead(200, { "content-type": "text/calendar; charset=UTF-8" });
    res.end(ausgeliefert);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const adresse = server.address();
  basis = `http://127.0.0.1:${typeof adresse === "object" && adresse ? adresse.port : 0}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("Abonnierter Kalender", () => {
  const feedUrl = () => `${basis}/calendar/ical/x/private-abc/basic.ics`;

  it("macht aus der einen Datei zwei Termine", async () => {
    const c = await createIcsClient(feedUrl(), "Johanna");
    const r = await c.fetchChanges(feedUrl());
    expect(r.objects.map((o) => o.href).sort()).toEqual([
      "joh-kurs@google.com",
      "joh-physio@google.com",
    ]);
  });

  it("rechnet die Berliner Zeitzone richtig", async () => {
    const c = await createIcsClient(feedUrl(), "Johanna");
    const r = await c.fetchChanges(feedUrl());
    const physio = r.objects.find((o) => o.href === "joh-physio@google.com")!;
    const occ = expandOccurrences(
      physio.ics,
      new Date("2026-08-11T00:00:00Z"),
      new Date("2026-08-13T00:00:00Z"),
    );
    // 14:00 Berliner Sommerzeit ist 12:00 UTC. Ohne den mitgegebenen
    // VTIMEZONE-Block stünde hier die falsche Uhrzeit.
    expect(occ[0].start.toISOString()).toBe("2026-08-12T12:00:00.000Z");
    expect(occ[0].summary).toBe("Physiotherapie");
  });

  it("hält Serie und verschobenes Vorkommen zusammen", async () => {
    const c = await createIcsClient(feedUrl(), "Johanna");
    const r = await c.fetchChanges(feedUrl());
    const kurs = r.objects.find((o) => o.href === "joh-kurs@google.com")!;
    const occ = expandOccurrences(
      kurs.ics,
      new Date("2026-08-12T00:00:00Z"),
      new Date("2026-09-10T00:00:00Z"),
    );
    expect(occ).toHaveLength(4);
    const verschoben = occ.find((o) => o.start.toISOString() === "2026-08-20T09:00:00.000Z");
    expect(verschoben?.summary).toBe("Rückbildung (eine Stunde später)");
  });

  it("liefert bei zwei Läufen denselben Abdruck", async () => {
    // Sonst schriebe jeder Abgleich alle Termine neu — und die Wochenansicht
    // würde alle fünf Minuten ihren Zwischenspeicher verwerfen.
    const c = await createIcsClient(feedUrl(), "Johanna");
    const a = await c.fetchChanges(feedUrl());
    const b = await c.fetchChanges(feedUrl());
    expect(a.objects.map((o) => o.etag)).toEqual(b.objects.map((o) => o.etag));
  });

  it("sagt, wenn dahinter kein Kalender liegt", async () => {
    // Der häufigste Fehler: die Adresse der Web-Ansicht kopiert statt der des
    // Kalenders. Dann kommt HTML zurück, und „0 Termine" wäre eine Lüge.
    const c = await createIcsClient(`${basis}/html`, "Falsch");
    await expect(c.fetchChanges("x")).rejects.toThrow(/kein Kalender/);
  });

  it("sagt, wenn die Adresse nicht antwortet", async () => {
    const c = await createIcsClient(`${basis}/weg`, "Weg");
    await expect(c.fetchChanges("x")).rejects.toThrow(/404/);
  });

  it("versteht webcal:// als https://", async () => {
    // So kopiert man die Adresse aus vielen Kalender-Apps heraus.
    const c = await createIcsClient(feedUrl().replace("http://", "webcal://"), "Johanna");
    await expect(c.fetchChanges("x")).rejects.toThrow();
  });

  it("weigert sich zu schreiben", async () => {
    const c = await createIcsClient(feedUrl(), "Johanna");
    await expect(c.putEvent("x", "y", "z")).rejects.toBeInstanceOf(NurLesendError);
    await expect(c.deleteEvent("y", "e")).rejects.toBeInstanceOf(NurLesendError);
  });

  describe("Der Abdruck des Feeds", () => {
    /*
     * Das Gegenstück zum CTag eines CalDAV-Servers. Er beantwortet die Frage,
     * die sich vor jeder Arbeit stellt: Hat sich überhaupt etwas geändert?
     *
     * Daran hängt mehr als Eleganz. Ohne ihn las der Abgleich alle fünf
     * Minuten jeden Termin des Haushalts aus der Datenbank, nur um
     * festzustellen, dass alles beim Alten ist — bei ~1900 Terminen rund
     * 170 MB am Tag. Genau daran war Neons Monatskontingent aufgebraucht.
     */
    it("bleibt gleich, solange der Feed gleich bleibt", async () => {
      const c = await createIcsClient(feedUrl(), "Johanna");
      const a = await c.fetchChanges(feedUrl());
      const b = await c.fetchChanges(feedUrl());
      expect(a.ctag).toBeTruthy();
      expect(b.ctag).toBe(a.ctag);
    });

    it("ändert sich, sobald sich am Feed etwas ändert", async () => {
      const c = await createIcsClient(feedUrl(), "Johanna");
      const vorher = await c.fetchChanges(feedUrl());
      ausgeliefert = FEED.replace("Physiotherapie", "Physio verschoben");
      try {
        const nachher = await c.fetchChanges(feedUrl());
        expect(nachher.ctag).not.toBe(vorher.ctag);
      } finally {
        ausgeliefert = FEED;
      }
    });
  });
});
