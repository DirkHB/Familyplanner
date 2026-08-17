import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer, type Server } from "node:http";
import { generateKeyPairSync } from "node:crypto";
import type { AddressInfo } from "node:net";

/**
 * Google, aber lokal.
 *
 * Der Test läuft gegen einen eigenen kleinen Server, der sich verhält wie
 * Googles API — samt der Fehler, auf die es ankommt: 404, wenn die Freigabe
 * fehlt, 403, wenn sie nur zum Lesen berechtigt. Genau diese beiden erzeugen
 * sonst Meldungen, mit denen niemand etwas anfangen kann.
 *
 * Die Adressen der echten Dienste werden über die Umgebung umgebogen. Weil
 * die Module sie beim Laden lesen, wird hier erst der Server gestartet, dann
 * die Umgebung gesetzt und erst danach importiert.
 */

type Aufruf = { methode: string; pfad: string; koerper: unknown };

let server: Server;
let aufrufe: Aufruf[] = [];
let modus = "ok";

let googleAnlegen: typeof import("./google-client").googleAnlegen;
let googleAendern: typeof import("./google-client").googleAendern;
let googleLoeschen: typeof import("./google-client").googleLoeschen;
let pruefeGoogleKalender: typeof import("./google-client").pruefeGoogleKalender;
let GoogleError: typeof import("./google-client").GoogleError;
let vergissZugang: typeof import("./google-auth").vergissZugang;
let zugangFuer: typeof import("./google-auth").zugangFuer;

const KONTO = { provider: "google" };

beforeAll(async () => {
  server = createServer((req, res) => {
    let roh = "";
    req.on("data", (c) => (roh += c));
    req.on("end", () => {
      const pfad = req.url ?? "";
      const antworte = (code: number, body: unknown) => {
        res.writeHead(code, { "Content-Type": "application/json" });
        res.end(JSON.stringify(body));
      };

      if (pfad === "/token") {
        aufrufe.push({ methode: "POST", pfad: "/token", koerper: roh });
        if (modus === "keinzugang") {
          return antworte(400, { error: "invalid_grant", error_description: "account not found" });
        }
        return antworte(200, { access_token: "tok-1", expires_in: 3600 });
      }

      aufrufe.push({
        methode: req.method ?? "",
        pfad,
        koerper: roh ? JSON.parse(roh) : null,
      });

      if (modus === "keinkalender") return antworte(404, { error: { message: "Not Found" } });

      // GET /calendars/{id}
      if (req.method === "GET" && /^\/calendars\/[^/]+$/.test(pfad)) {
        return antworte(200, { summary: "Johannas Kalender" });
      }
      if (req.method === "POST" && /\/events\/import$/.test(pfad)) {
        if (modus === "nurlesend") {
          return antworte(403, { error: { message: "You need to have writer access." } });
        }
        const rein = roh ? JSON.parse(roh) : {};
        // Google gibt die mitgebrachte UID zurück — darauf beruht alles Weitere.
        return antworte(200, {
          id: "evt-7",
          iCalUID: modus === "fremdeuid" ? "etwas-anderes@google.com" : rein.iCalUID,
        });
      }
      if (req.method === "PATCH") return antworte(200, { id: "evt-7" });
      if (req.method === "DELETE") {
        if (modus === "wegundweg") return antworte(404, { error: { message: "Not Found" } });
        if (modus === "kaputt") return antworte(500, { error: { message: "Serverfehler" } });
        res.writeHead(204);
        return res.end();
      }
      return antworte(400, { error: { message: `Unerwartet: ${req.method} ${pfad}` } });
    });
  });

  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  const basis = `http://127.0.0.1:${port}`;

  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.GOOGLE_TOKEN_URL = `${basis}/token`;
  process.env.GOOGLE_API_BASE = basis;
  process.env.GOOGLE_SA_CLIENT_EMAIL = "test@projekt.iam.gserviceaccount.com";
  process.env.GOOGLE_SA_PRIVATE_KEY = privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString();

  const client = await import("./google-client");
  const auth = await import("./google-auth");
  googleAnlegen = client.googleAnlegen;
  googleAendern = client.googleAendern;
  googleLoeschen = client.googleLoeschen;
  pruefeGoogleKalender = client.pruefeGoogleKalender;
  GoogleError = client.GoogleError;
  vergissZugang = auth.vergissZugang;
  zugangFuer = auth.zugangFuer;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(() => {
  aufrufe = [];
  modus = "ok";
  vergissZugang();
});

describe("Anmeldung", () => {
  it("holt ein Token und behält es", async () => {
    await zugangFuer(KONTO);
    await zugangFuer(KONTO);
    // Ein Token gilt eine Stunde. Es zweimal zu holen wäre eine Anfrage je
    // Termin — bei einem Abgleich über mehrere Haushalte spürbar.
    expect(aufrufe.filter((a) => a.pfad === "/token")).toHaveLength(1);
  });

  it("sagt, wenn Google den Zugang verweigert", async () => {
    modus = "keinzugang";
    await expect(zugangFuer(KONTO)).rejects.toThrow(/account not found/);
  });
});

describe("Termin anlegen", () => {
  it("schickt Uhrzeiten mit Zeitzone und gibt beide Kennungen zurück", async () => {
    const r = await googleAnlegen(KONTO, "johanna@gmail.com", "fp-1@planyourweek.app", {
      title: "Rückbildung",
      start: new Date("2026-08-20T07:00:00.000Z"),
      end: new Date("2026-08-20T08:00:00.000Z"),
      allDay: false,
      location: "Praxis",
    });

    expect(r).toEqual({ id: "evt-7", uid: "fp-1@planyourweek.app" });

    const post = aufrufe.find((a) => a.methode === "POST" && a.pfad.includes("/events"));
    expect(post?.koerper).toMatchObject({
      summary: "Rückbildung",
      location: "Praxis",
      start: { dateTime: "2026-08-20T07:00:00.000Z", timeZone: "Europe/Berlin" },
    });
    // Die UID bleibt unsere. Unter ihr kommt der Termin über den Feed zurück,
    // und nur daran erkennen wir unseren eigenen wieder.
    expect(post?.koerper).toMatchObject({ iCalUID: "fp-1@planyourweek.app" });
  });

  it("schickt Ganztagstermine als Datum ohne Uhrzeit", async () => {
    await googleAnlegen(KONTO, "johanna@gmail.com", "fp-2@planyourweek.app", {
      title: "Urlaub",
      start: new Date("2026-08-14T12:00:00.000Z"),
      end: new Date("2026-08-15T12:00:00.000Z"),
      allDay: true,
    });
    const post = aufrufe.find((a) => a.methode === "POST" && a.pfad.includes("/events"));
    expect(post?.koerper).toMatchObject({
      start: { date: "2026-08-14" },
      end: { date: "2026-08-15" },
    });
    expect(JSON.stringify(post?.koerper)).not.toContain("dateTime");
  });

  it("lädt niemanden ein", async () => {
    // Ein Service Account darf ohne Domain-Wide Delegation gar keine
    // Teilnehmer setzen — Google wiese das ab. Wir schreiben Termine, wir
    // verschicken keine Einladungen.
    await googleAnlegen(KONTO, "j@gmail.com", "fp-3@planyourweek.app", {
      title: "X",
      start: new Date("2026-08-20T07:00:00Z"),
      end: new Date("2026-08-20T08:00:00Z"),
      allDay: false,
    });
    const post = aufrufe.find((a) => a.methode === "POST" && a.pfad.includes("/events"));
    expect(JSON.stringify(post?.koerper)).not.toContain("attendees");
  });

  it("scheitert laut, wenn Google die UID austauscht", async () => {
    // Still hinnehmen hieße: ein Termin im Kalender, den wir nie wiederfinden.
    modus = "fremdeuid";
    await expect(
      googleAnlegen(KONTO, "j@gmail.com", "fp-4@planyourweek.app", {
        title: "X",
        start: new Date("2026-08-20T07:00:00Z"),
        end: new Date("2026-08-20T08:00:00Z"),
        allDay: false,
      }),
    ).rejects.toThrow(/UID geändert/);
  });
});

describe("Termin ändern", () => {
  it("schickt nur, was sich ändert", async () => {
    await googleAendern(KONTO, "j@gmail.com", "evt-7", { title: "Neuer Titel" });
    const patch = aufrufe.find((a) => a.methode === "PATCH");
    expect(patch?.koerper).toEqual({ summary: "Neuer Titel" });
  });
});

describe("Termin löschen", () => {
  it("nimmt ein schon verschwundenes Ereignis hin", async () => {
    // Weg ist weg — genau wie beim iCloud-Weg, der einen 404 durchgehen lässt,
    // damit lokal trotzdem aufgeräumt wird.
    modus = "wegundweg";
    await expect(googleLoeschen(KONTO, "j@gmail.com", "evt-7")).resolves.toBeUndefined();
  });

  it("meldet einen echten Fehler weiter", async () => {
    modus = "kaputt";
    await expect(googleLoeschen(KONTO, "j@gmail.com", "evt-7")).rejects.toThrow(GoogleError);
  });
});

describe("Verbindung prüfen", () => {
  it("probiert wirklich aus und räumt hinter sich auf", async () => {
    const r = await pruefeGoogleKalender(KONTO, "johanna@gmail.com");
    expect(r).toEqual({ ok: true, name: "Johannas Kalender" });
    // Angelegt und wieder gelöscht — sonst stünde ein Probetermin im Kalender.
    expect(aufrufe.some((a) => a.methode === "POST" && a.pfad.includes("/events"))).toBe(true);
    expect(aufrufe.some((a) => a.methode === "DELETE")).toBe(true);
  });

  it("erklärt eine fehlende Freigabe, statt „404“ zu sagen", async () => {
    modus = "keinkalender";
    const r = await pruefeGoogleKalender(KONTO, "johanna@gmail.com");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.grund).toMatch(/Freigabe/);
      expect(r.nurLesend).toBe(false);
    }
  });

  it("erkennt, wenn die Freigabe nur zum Lesen berechtigt", async () => {
    modus = "nurlesend";
    const r = await pruefeGoogleKalender(KONTO, "johanna@gmail.com");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.nurLesend).toBe(true);
      expect(r.grund).toMatch(/Änderungen an Terminen vornehmen/);
    }
  });
});

describe("Ein beschädigter Schlüssel", () => {
  /*
   * Der Fall aus dem Betrieb: In Sliplane war der private Schlüssel beim
   * Eintragen kaputtgegangen, und in der Oberfläche stand
   * „error:1E08010C:DECODER routines::unsupported". Das ist OpenSSLs
   * Innenleben — es stand vor jemandem, der seinen Kalender verbinden wollte
   * und nichts dagegen tun konnte.
   */
  it("sagt, dass es am Server liegt, statt OpenSSL zu zitieren", async () => {
    const echt = process.env.GOOGLE_SA_PRIVATE_KEY;
    process.env.GOOGLE_SA_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nkaputt\\n-----END PRIVATE KEY-----\\n";
    vergissZugang();
    try {
      const r = await pruefeGoogleKalender(KONTO, "johanna@gmail.com");
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.grund).toMatch(/Einrichtung des Servers/);
        expect(r.grund).not.toMatch(/DECODER|1E08010C/);
      }
    } finally {
      process.env.GOOGLE_SA_PRIVATE_KEY = echt;
      vergissZugang();
    }
  });

  it("bietet den Weg gar nicht erst an", async () => {
    const { dienstkontoAdresse } = await import("./google-auth");
    const echt = process.env.GOOGLE_SA_PRIVATE_KEY;
    process.env.GOOGLE_SA_PRIVATE_KEY = "unsinn";
    try {
      // Sonst stünde die Adresse einladend da, jemand trüge sie in Google ein
      // und erführe erst nach acht Handgriffen, dass es am Server scheitert.
      expect(dienstkontoAdresse()).toBeNull();
    } finally {
      process.env.GOOGLE_SA_PRIVATE_KEY = echt;
    }
  });
});

describe("Die ganze Schlüsseldatei als eine Zeile", () => {
  /*
   * Der Weg, der den privaten Schlüssel unbeschadet durch Zwischenablage und
   * Eingabefeld bringt. Uns ist er auf dem alten Weg genau dort zerbrochen —
   * zwischen der JSON-Datei und dem Feld beim Hoster.
   */
  it("nimmt GOOGLE_SA_JSON_BASE64 statt der beiden Einzelwerte", async () => {
    const { generateKeyPairSync } = await import("node:crypto");
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const datei = {
      client_email: "kalender@planyourweek.iam.gserviceaccount.com",
      private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    };

    const alteMail = process.env.GOOGLE_SA_CLIENT_EMAIL;
    const alterKey = process.env.GOOGLE_SA_PRIVATE_KEY;
    delete process.env.GOOGLE_SA_CLIENT_EMAIL;
    delete process.env.GOOGLE_SA_PRIVATE_KEY;
    process.env.GOOGLE_SA_JSON_BASE64 = Buffer.from(JSON.stringify(datei)).toString("base64");
    vergissZugang();
    try {
      // Kommt ein Token zurück, hat der Schlüssel den Weg heil überstanden.
      await expect(zugangFuer(KONTO)).resolves.toBe("tok-1");
    } finally {
      delete process.env.GOOGLE_SA_JSON_BASE64;
      process.env.GOOGLE_SA_CLIENT_EMAIL = alteMail;
      process.env.GOOGLE_SA_PRIVATE_KEY = alterKey;
      vergissZugang();
    }
  });

  it("sagt es, wenn dort kein Schlüssel drinsteht", async () => {
    process.env.GOOGLE_SA_JSON_BASE64 = Buffer.from("kein json").toString("base64");
    vergissZugang();
    try {
      const r = await pruefeGoogleKalender(KONTO, "j@gmail.com");
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.grund).toMatch(/GOOGLE_SA_JSON_BASE64/);
    } finally {
      delete process.env.GOOGLE_SA_JSON_BASE64;
      vergissZugang();
    }
  });
});

describe("Ein zugerichteter Schlüssel", () => {
  /*
   * Die Umbrüche im PEM sind die einzige Bruchstelle. Sie müssen durch
   * Zwischenablage, Editor und Eingabefeld kommen — und irgendeine Station
   * verschluckt oder ersetzt sie. Genau daran ist uns der Zugang zerbrochen.
   */
  const faelle: [string, (pem: string) => string][] = [
    ["ganz ohne Umbrüche", (pem) => pem.replace(/\n/g, "")],
    ["mit Leerzeichen statt Umbrüchen", (pem) => pem.replace(/\n/g, " ")],
    ["mit literalen \\n", (pem) => pem.replace(/\n/g, "\\n")],
    ["mit Wagenrücklauf davor", (pem) => pem.replace(/\n/g, "\r\n")],
  ];

  for (const [name, zurichten] of faelle) {
    it(`kommt ${name} zurecht`, async () => {
      const { generateKeyPairSync } = await import("node:crypto");
      const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
      const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

      const alt = process.env.GOOGLE_SA_PRIVATE_KEY;
      process.env.GOOGLE_SA_PRIVATE_KEY = zurichten(pem);
      vergissZugang();
      try {
        await expect(zugangFuer(KONTO)).resolves.toBe("tok-1");
      } finally {
        process.env.GOOGLE_SA_PRIVATE_KEY = alt;
        vergissZugang();
      }
    });
  }

  it("bleibt bei einem abgeschnittenen Schlüssel ehrlich", async () => {
    // Was fehlt, lässt sich nicht neu falten. Dann muss es scheitern.
    const alt = process.env.GOOGLE_SA_PRIVATE_KEY;
    process.env.GOOGLE_SA_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq\n-----END PRIVATE KEY-----\n";
    vergissZugang();
    try {
      await expect(zugangFuer(KONTO)).rejects.toThrow(/nicht lesen/);
    } finally {
      process.env.GOOGLE_SA_PRIVATE_KEY = alt;
      vergissZugang();
    }
  });
});
