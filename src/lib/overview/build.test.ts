import { describe, it, expect } from "vitest";
import { buildOverview, briefingText, splitLabel, type OverviewEvent, type OverviewTodo } from "./build";

const ev = (p: Partial<OverviewEvent> & { uid: string; dayKey: string }): OverviewEvent => ({
  dayLabel: "Do, 30. Juli",
  time: "10:00",
  title: "Termin",
  allDay: false,
  care: null,
  carePerson: null,
  ...p,
});
const td = (p: Partial<OverviewTodo> & { id: string }): OverviewTodo => ({
  title: "Aufgabe",
  dueLabel: null,
  overdue: false,
  assignee: null,
  ...p,
});

describe("buildOverview", () => {
  it("gruppiert Termine nach Tag und zählt sie", () => {
    const o = buildOverview({
      events: [
        ev({ uid: "a", dayKey: "2026-07-30", title: "Arzt" }),
        ev({ uid: "b", dayKey: "2026-07-30", title: "Einkauf" }),
        ev({ uid: "c", dayKey: "2026-07-31", title: "Sport", dayLabel: "Fr, 31. Juli" }),
      ],
      todos: [],
    });
    expect(o.days).toHaveLength(2);
    expect(o.days[0].events).toHaveLength(2);
    expect(o.eventCount).toBe(3);
  });

  it("sammelt offene Betreuung und Aufgaben, überfällige zuerst", () => {
    const o = buildOverview({
      events: [ev({ uid: "a", dayKey: "2026-07-30", title: "Arzt", care: "offen" })],
      todos: [td({ id: "1", title: "Normal" }), td({ id: "2", title: "Alt", overdue: true })],
    });
    expect(o.open[0]).toMatchObject({ kind: "care", label: "Arzt" });
    expect(o.open[1]).toMatchObject({ kind: "todo", label: "Alt" });
    expect(o.open[2]).toMatchObject({ kind: "todo", label: "Normal" });
  });

  it("zählt die Verteilung getrennt für Betreuung und Aufgaben", () => {
    const o = buildOverview({
      events: [
        ev({ uid: "a", dayKey: "2026-07-30", care: "da", carePerson: "constanze" }),
        ev({ uid: "b", dayKey: "2026-07-30", care: "da", carePerson: "dirk" }),
        ev({ uid: "c", dayKey: "2026-07-31", care: "offen" }),
      ],
      todos: [td({ id: "1", assignee: "dirk" }), td({ id: "2" })],
    });
    expect(o.careSplit).toMatchObject({ constanze: 1, dirk: 1, offen: 1 });
    expect(o.todoSplit).toMatchObject({ constanze: 0, dirk: 1, offen: 1 });
  });
});

describe("splitLabel", () => {
  it("bleibt beschreibend und nennt Constanze zuerst", () => {
    expect(splitLabel(0, 0, 0, "Betreuung")).toMatch(/Nichts/);
    expect(splitLabel(2, 2, 0, "Betreuung")).toMatch(/Gleichmäßig/);
    expect(splitLabel(3, 1, 0, "Betreuung")).toBe("Constanze hat mehr Betreuung (3 zu 1).");
    expect(splitLabel(1, 3, 0, "Aufgaben")).toBe("Dirk hat mehr Aufgaben (1 zu 3).");
  });
});

describe("briefingText", () => {
  it("Morgen-Text nennt heutige Termine und offene Punkte", () => {
    const o = buildOverview({
      events: [ev({ uid: "a", dayKey: "2026-07-30", title: "Kinderarzt", care: "offen" })],
      todos: [td({ id: "1" })],
    });
    const t = briefingText(o, "morgen");
    expect(t).toMatch(/Kinderarzt/);
    expect(t).toMatch(/Betreuung offen/);
    expect(t.length).toBeLessThanOrEqual(160);
  });

  it("meldet Entwarnung, wenn nichts offen ist", () => {
    const o = buildOverview({ events: [ev({ uid: "a", dayKey: "2026-07-30", title: "Sport" })], todos: [] });
    expect(briefingText(o, "morgen")).toMatch(/Alles geklärt/);
  });

  it("Wochen-Text zählt Termine", () => {
    const o = buildOverview({
      events: [ev({ uid: "a", dayKey: "2026-08-03" }), ev({ uid: "b", dayKey: "2026-08-04" })],
      todos: [],
    });
    expect(briefingText(o, "woche")).toMatch(/2 Termine/);
  });
});

describe("horizonRange / defaultHorizon", () => {
  it("bis-sonntag beginnt jetzt und endet Sonntag 24 Uhr", async () => {
    const { horizonRange } = await import("./horizon");
    // Dienstag, 28.07.2026, 14:00 Berlin = 12:00 UTC
    const now = new Date("2026-07-28T12:00:00Z");
    const { from, to } = horizonRange("bis-sonntag", now);
    expect(from.getTime()).toBe(now.getTime()); // ab jetzt, nicht ab heute früh
    // Ende = Montag 00:00 Berlin = Sonntag 22:00 UTC (Sommerzeit)
    expect(to.toISOString()).toBe("2026-08-02T22:00:00.000Z");
  });

  it("nächste Woche läuft Mo–So nach dem laufenden Sonntag", async () => {
    const { horizonRange } = await import("./horizon");
    const now = new Date("2026-07-28T12:00:00Z"); // Dienstag
    const { from, to } = horizonRange("naechste-woche", now);
    expect(from.toISOString()).toBe("2026-08-02T22:00:00.000Z"); // Mo 03.08. 00:00 Berlin
    expect(to.toISOString()).toBe("2026-08-09T22:00:00.000Z"); // Mo 10.08. 00:00 Berlin
  });

  it("zeigt sonntags nach dem Umschalten noch den Rest des Sonntags", async () => {
    const { horizonRange } = await import("./horizon");
    // Sonntag, 02.08.2026, 14:00 Berlin = 12:00 UTC
    const sonntagNachmittag = new Date("2026-08-02T12:00:00Z");
    const { from, to } = horizonRange("naechste-woche", sonntagNachmittag);
    expect(from.getTime()).toBe(sonntagNachmittag.getTime()); // Rest des Sonntags bleibt drin
    expect(to.toISOString()).toBe("2026-08-09T22:00:00.000Z"); // bis Ende nächster Sonntag
  });

  it("schaltet sonntags ab 12 Uhr auf die nächste Woche um", async () => {
    const { defaultHorizon } = await import("./horizon");
    // Sonntag, 02.08.2026
    expect(defaultHorizon(new Date("2026-08-02T09:00:00Z"))).toBe("bis-sonntag"); // 11:00 Berlin
    expect(defaultHorizon(new Date("2026-08-02T10:00:00Z"))).toBe("naechste-woche"); // 12:00 Berlin
    expect(defaultHorizon(new Date("2026-07-28T12:00:00Z"))).toBe("bis-sonntag"); // Dienstag
  });

  it("berlinWeekday stimmt auch in der Sommerzeit", async () => {
    const { berlinWeekday } = await import("./horizon");
    expect(berlinWeekday(new Date("2026-07-30T12:00:00Z"))).toBe(3); // Donnerstag
    expect(berlinWeekday(new Date("2026-08-02T12:00:00Z"))).toBe(6); // Sonntag
    // 23:30 Berlin am Donnerstag (= 21:30 UTC) ist immer noch Donnerstag
    expect(berlinWeekday(new Date("2026-07-30T21:30:00Z"))).toBe(3);
  });
});
