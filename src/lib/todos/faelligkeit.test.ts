import { describe, it, expect } from "vitest";
import { tagesSchluessel, vorschlaege, datumsLabel, istVergangen } from "./faelligkeit";

/**
 * Berlin, nicht die Zeitzone des Servers. Und über die Zeitumstellung hinweg,
 * weil sonst „morgen" einmal im Jahr „heute" heißt.
 */
describe("Fälligkeit", () => {
  it("nimmt den Berliner Tag, nicht den UTC-Tag", () => {
    // 23:30 Uhr in Berlin ist 21:30 UTC — in UTC noch derselbe Tag, aber
    // eine halbe Stunde später beginnt in Berlin schon der nächste.
    expect(tagesSchluessel(new Date("2026-08-10T21:30:00Z"))).toBe("2026-08-10");
    expect(tagesSchluessel(new Date("2026-08-10T22:30:00Z"))).toBe("2026-08-11");
  });

  it("sagt zwischen Mitternacht und zwei Uhr immer noch „heute“", () => {
    // 00:30 Uhr in Berlin ist 22:30 UTC am Vortag. Ohne Zeitzone hieße
    // „heute" hier „gestern" — und in genau dieser Stunde legt man die
    // Aufgaben an, die einem nicht aus dem Kopf gehen.
    const nachts = new Date("2026-08-10T22:30:00Z");
    expect(vorschlaege(nachts)[0]).toEqual({ schluessel: "2026-08-11", label: "Heute" });
  });

  it("zählt morgen über die Zeitumstellung hinweg richtig", () => {
    // In der Nacht auf den 25.10.2026 wird die Uhr zurückgestellt. 24 Stunden
    // auf Mitternacht zu addieren ergäbe wieder denselben Tag.
    const vorher = new Date("2026-10-24T10:00:00Z");
    expect(vorschlaege(vorher)[1].schluessel).toBe("2026-10-25");
    const nachher = new Date("2026-10-25T10:00:00Z");
    expect(vorschlaege(nachher)[1].schluessel).toBe("2026-10-26");
  });

  it("meint mit Wochenende den kommenden Samstag", () => {
    // Montag, 10.08.2026 → Samstag, 15.08.
    expect(vorschlaege(new Date("2026-08-10T10:00:00Z"))[2].schluessel).toBe("2026-08-15");
    // Freitag → morgen
    expect(vorschlaege(new Date("2026-08-14T10:00:00Z"))[2].schluessel).toBe("2026-08-15");
  });

  it("meint am Wochenende selbst heute", () => {
    // Wer samstags „Wochenende" antippt, meint nicht in acht Tagen.
    expect(vorschlaege(new Date("2026-08-15T10:00:00Z"))[2].schluessel).toBe("2026-08-15");
    expect(vorschlaege(new Date("2026-08-16T10:00:00Z"))[2].schluessel).toBe("2026-08-16");
  });

  it("gibt drei Vorschläge mit den erwarteten Namen", () => {
    expect(vorschlaege(new Date("2026-08-10T10:00:00Z")).map((v) => v.label)).toEqual([
      "Heute",
      "Morgen",
      "Wochenende",
    ]);
  });

  it("schreibt heute und morgen als Wort", () => {
    const jetzt = new Date("2026-08-10T10:00:00Z");
    expect(datumsLabel("2026-08-10", jetzt)).toBe("Heute");
    expect(datumsLabel("2026-08-11", jetzt)).toBe("Morgen");
  });

  it("schreibt alles andere mit Wochentag", () => {
    const jetzt = new Date("2026-08-10T10:00:00Z");
    // „Do, 13. Aug." sagt mehr als „13.08." — man weiß sofort, ob das noch
    // diese Woche ist.
    expect(datumsLabel("2026-08-13", jetzt)).toBe("Do., 13. Aug.");
  });

  it("verträgt leere und kaputte Eingaben", () => {
    expect(datumsLabel("")).toBe("");
    expect(datumsLabel("quatsch")).toBe("quatsch");
    expect(istVergangen("")).toBe(false);
  });

  it("erkennt einen Tag in der Vergangenheit", () => {
    const jetzt = new Date("2026-08-10T10:00:00Z");
    expect(istVergangen("2026-08-09", jetzt)).toBe(true);
    expect(istVergangen("2026-08-10", jetzt)).toBe(false);
    expect(istVergangen("2026-08-11", jetzt)).toBe(false);
  });
});
