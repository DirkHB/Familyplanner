import { describe, it, expect } from "vitest";
import { normalizeCapture } from "./schemas";

describe("normalizeCapture", () => {
  it("übernimmt gültige Events", () => {
    const r = normalizeCapture({
      events: [
        {
          title: "Kinderarzt U3",
          allDay: false,
          start: "2026-07-30T13:00:00+02:00",
          end: "2026-07-30T13:45:00+02:00",
          category: "arzt",
          careNeeded: true,
          checklist: ["Versichertenkarte", "U-Heft"],
          notes: "",
        },
      ],
    });
    expect(r.events).toHaveLength(1);
    expect(r.events[0].category).toBe("arzt");
    expect(r.events[0].careNeeded).toBe(true);
  });

  it("setzt unbekannte Kategorie auf sonstiges", () => {
    const r = normalizeCapture({
      events: [{ title: "X", start: "2026-07-30T10:00:00+02:00", category: "quatsch" }],
    });
    expect(r.events[0].category).toBe("sonstiges");
    expect(r.events[0].end).toBe("2026-07-30T10:00:00+02:00"); // end fällt auf start zurück
  });

  it("überspringt Events ohne Titel/Start", () => {
    const r = normalizeCapture({ events: [{ title: "", start: "x" }, { foo: 1 }] });
    expect(r.events).toHaveLength(0);
  });

  it("ist robust gegen Müll", () => {
    expect(normalizeCapture(null).events).toEqual([]);
    expect(normalizeCapture({}).events).toEqual([]);
    expect(normalizeCapture({ events: "nope" }).events).toEqual([]);
  });
});
