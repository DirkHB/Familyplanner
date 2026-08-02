import { describe, it, expect } from "vitest";
import { wochenBriefing, type BriefingTermin } from "./wochen-briefing";

function t(partial: Partial<BriefingTermin> & { title: string }): BriefingTermin {
  return { time: "10:00", past: false, allDay: false, careOffen: false, ...partial };
}

describe("wochenBriefing", () => {
  it("nennt den nächsten Termin, nicht alle", () => {
    const s = wochenBriefing({
      heute: [t({ title: "Physio", time: "09:00", past: true }), t({ title: "Einkauf", time: "16:30" }), t({ title: "Tennis", time: "19:00" })],
      naechster: null,
      aufgabenHeute: 0,
    });
    expect(s).toBe("Heute noch 2 Termine — als Nächstes 16:30 Einkauf.");
  });

  it("ein einzelner Resttermin steht direkt da", () => {
    expect(
      wochenBriefing({ heute: [t({ title: "Tennis", time: "19:00" })], naechster: null, aufgabenHeute: 0 }),
    ).toBe("Heute noch: 19:00 Tennis.");
  });

  it("alles vorbei: sagt es freundlich", () => {
    expect(
      wochenBriefing({ heute: [t({ title: "Physio", past: true })], naechster: null, aufgabenHeute: 0 }),
    ).toBe("Die Termine für heute sind geschafft. Nichts offen.");
  });

  it("leerer Tag zeigt auf den nächsten Termin", () => {
    expect(
      wochenBriefing({
        heute: [],
        naechster: { tagLabel: "Mittwoch", time: "10:15", title: "Kinderarzt · U3" },
        aufgabenHeute: 0,
      }),
    ).toBe("Heute ist nichts im Kalender — als Nächstes Mittwoch 10:15 Kinderarzt · U3. Nichts offen.");
  });

  it("offene Betreuung und fällige Aufgaben kommen dazu — vergangene Betreuung nicht", () => {
    const s = wochenBriefing({
      heute: [
        t({ title: "Vormittag", past: true, careOffen: true }),
        t({ title: "Einkauf", time: "16:30", careOffen: true }),
      ],
      naechster: null,
      aufgabenHeute: 2,
    });
    expect(s).toBe(
      "Heute noch: 16:30 Einkauf. Einmal ist die Betreuung noch offen. 2 Aufgaben sind heute fällig.",
    );
  });

  it("Ganztägiges zählt nicht als Resttermin", () => {
    const s = wochenBriefing({
      heute: [t({ title: "Urlaub", allDay: true })],
      naechster: null,
      aufgabenHeute: 0,
    });
    expect(s).toBe("Die nächsten Tage sind frei. Nichts offen.");
  });
});
