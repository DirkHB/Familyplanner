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
      if (req.method === "POST" && /\/events(\?|$)/.test(pfad)) {
        if (modus === "nurlesend") {
          return antworte(403, { error: { message: "You need to have writer access." } });
        }
        return antworte(200, { id: "evt-7", iCalUID: "evt-7@google.com" });
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
    const r = await googleAnlegen(KONTO, "johanna@gmail.com", {
      title: "Rückbildung",
      start: new Date("2026-08-20T07:00:00.000Z"),
      end: new Date("2026-08-20T08:00:00.000Z"),
      allDay: false,
      location: "Praxis",
    });

    expect(r).toEqual({ id: "evt-7", uid: "evt-7@google.com" });

    const post = aufrufe.find((a) => a.methode === "POST" && a.pfad.includes("/events"));
    expect(post?.koerper).toMatchObject({
      summary: "Rückbildung",
      location: "Praxis",
      start: { dateTime: "2026-08-20T07:00:00.000Z", timeZone: "Europe/Berlin" },
    });
    // Die UID ist der Schlüssel: Unter ihr kommt der Termin über den Feed
    // zurück, und nur daran erkennen wir unseren eigenen wieder.
    expect(r.uid).toContain("@google.com");
  });

  it("schickt Ganztagstermine als Datum ohne Uhrzeit", async () => {
    await googleAnlegen(KONTO, "johanna@gmail.com", {
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

  it("schickt keine Einladungen", async () => {
    await googleAnlegen(KONTO, "j@gmail.com", {
      title: "X",
      start: new Date("2026-08-20T07:00:00Z"),
      end: new Date("2026-08-20T08:00:00Z"),
      allDay: false,
    });
    const post = aufrufe.find((a) => a.methode === "POST" && a.pfad.includes("/events"));
    expect(post?.pfad).toContain("sendUpdates=none");
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
