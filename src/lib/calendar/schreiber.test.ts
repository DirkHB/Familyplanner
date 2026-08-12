import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import { generateKeyPairSync } from "node:crypto";
import type { AddressInfo } from "node:net";

/**
 * Was der Schreiber nach oben zurückgibt, landet unverändert in der
 * Event-Zeile. Zwei Felder entscheiden dabei, ob der nächste Abgleich sauber
 * läuft — und beide sind bei Google anders als bei iCloud.
 */

let server: Server;
let schreiberFuer: typeof import("./schreiber").schreiberFuer;
let kalenderIdAus: typeof import("./schreiber").kalenderIdAus;
let UnbekannterAnbieterError: typeof import("./schreiber").UnbekannterAnbieterError;

const zielGoogle = {
  provider: "google",
  calendarUrl: "google:johanna@gmail.com",
  username: "Johanna",
  password: "https://calendar.google.com/…/basic.ics",
};

beforeAll(async () => {
  server = createServer((req, res) => {
    let roh = "";
    req.on("data", (c) => (roh += c));
    req.on("end", () => {
      const pfad = req.url ?? "";
      if (pfad === "/token") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ access_token: "t", expires_in: 3600 }));
      }
      if (req.method === "POST" && /\/events\/import$/.test(pfad)) {
        const rein = JSON.parse(roh);
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ id: "google-kennung-1", iCalUID: rein.iCalUID }));
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
    });
  });

  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.GOOGLE_TOKEN_URL = `${basis}/token`;
  process.env.GOOGLE_API_BASE = basis;
  process.env.GOOGLE_SA_CLIENT_EMAIL = "t@p.iam.gserviceaccount.com";
  process.env.GOOGLE_SA_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  const m = await import("./schreiber");
  schreiberFuer = m.schreiberFuer;
  kalenderIdAus = m.kalenderIdAus;
  UnbekannterAnbieterError = m.UnbekannterAnbieterError;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("Wahl des Schreibers", () => {
  it("lehnt ein Abonnement ab, statt so zu tun als ob", async () => {
    // Ein Abonnement hat keinen Rückweg. Ein Termin dorthin wäre beim nächsten
    // Abgleich wieder weg — eine Absage ist die ehrlichere Antwort.
    const { schreiberFuer: f, UnbekannterAnbieterError: E } = await import("./schreiber");
    expect(() =>
      f({ provider: "ics", calendarUrl: "abo:1", username: "x", password: "y" }),
    ).toThrow(E);
  });

  it("liest die Kalender-ID aus der Adresse", () => {
    expect(kalenderIdAus("google:johanna@gmail.com")).toBe("johanna@gmail.com");
    // Was nicht so aussieht, bleibt wie es ist — kein stilles Verstümmeln.
    expect(kalenderIdAus("johanna@gmail.com")).toBe("johanna@gmail.com");
  });
});

describe("Google-Schreiber", () => {
  it("gibt die UID als href zurück, nicht eine Adresse", async () => {
    const r = await schreiberFuer(zielGoogle).anlegen("fp-9@planyourweek.app", {
      title: "Rückbildung",
      start: new Date("2026-08-20T07:00:00Z"),
      end: new Date("2026-08-20T08:00:00Z"),
      allDay: false,
    });

    /*
     * Der Feed kennt keine Adressen je Termin — dort ist die UID der einzige
     * Schlüssel, der zwei Läufe überdauert. Stünde hier etwas anderes, legte
     * der nächste Abgleich denselben Termin ein zweites Mal an.
     */
    expect(r.href).toBe("fp-9@planyourweek.app");
    // Googles eigene Kennung wird gebraucht, um später zu ändern und zu löschen.
    expect(r.providerEventId).toBe("google-kennung-1");
    // Noch kein Abdruck vom Feed — der nächste Abgleich frischt einmal auf.
    expect(r.etag).toBeNull();
  });

  it("baut die .ics trotzdem, obwohl Google sie nicht bekommt", async () => {
    // Die Event-Zeile trägt rawIcs, und der Rest der App rechnet daraus. Ohne
    // sie stünde ein frisch angelegter Termin halb da, bis der Feed ihn bringt.
    const r = await schreiberFuer(zielGoogle).anlegen("fp-10@planyourweek.app", {
      title: "Zahnarzt",
      start: new Date("2026-08-20T07:00:00Z"),
      end: new Date("2026-08-20T08:00:00Z"),
      allDay: false,
      location: "Praxis Dr. Meier",
    });
    expect(r.rawIcs).toContain("BEGIN:VEVENT");
    expect(r.rawIcs).toContain("UID:fp-10@planyourweek.app");
    expect(r.rawIcs).toContain("Zahnarzt");
  });

  it("ändert und löscht nicht ohne Googles Kennung", async () => {
    const ohne = {
      uid: "fp-11@planyourweek.app",
      href: "fp-11@planyourweek.app",
      etag: null,
      rawIcs: "",
      providerEventId: null,
    };
    const s = schreiberFuer(zielGoogle);
    // Lieber eine klare Absage als ein Aufruf, der irgendetwas trifft.
    await expect(
      s.aendern(ohne, {
        title: "X",
        start: new Date(),
        end: new Date(),
        allDay: false,
      }),
    ).rejects.toThrow(/Kennung/);
    await expect(s.loeschen(ohne)).rejects.toThrow(/Kennung/);
  });
});
