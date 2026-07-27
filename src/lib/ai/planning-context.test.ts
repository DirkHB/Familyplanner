import { describe, it, expect } from "vitest";
import { buildPlanningContext, renderPlanningPrompt, type ContextDay } from "./planning-context";

const days: ContextDay[] = [
  {
    weekday: "Mo",
    dayNumber: "28",
    events: [
      { time: "15:00", title: "Kinderarzt U3", categoryLabel: "Arzt", care: { status: "offen", label: "Betreuung offen" } },
    ],
  },
  {
    weekday: "Di",
    dayNumber: "29",
    events: [
      { time: "", title: "Geburtstag Oma", categoryLabel: "Geburtstag", care: null },
    ],
  },
  { weekday: "Mi", dayNumber: "30", events: [] },
];

describe("buildPlanningContext", () => {
  it("sammelt Betreuungslücken aus offenen Terminen", () => {
    const ctx = buildPlanningContext({
      todayLabel: "Sonntag, 27.07.",
      days,
      openRequests: ["Constanze fragt: Einkauf am Samstag?"],
      fairnessLabel: "Gut verteilt.",
      patterns: [],
    });
    expect(ctx.careGaps).toHaveLength(1);
    expect(ctx.careGaps[0]).toMatch(/Kinderarzt/);
    expect(ctx.week).toHaveLength(3);
  });

  it("formatiert ganztägige Termine ohne Zeit", () => {
    const ctx = buildPlanningContext({
      todayLabel: "x",
      days,
      openRequests: [],
      fairnessLabel: "x",
      patterns: [],
    });
    expect(ctx.week[1].events[0]).toMatch(/ganztägig/);
  });
});

describe("renderPlanningPrompt", () => {
  it("enthält Constanze und Dirk und alle Abschnitte", () => {
    const ctx = buildPlanningContext({
      todayLabel: "Sonntag, 27.07.",
      days,
      openRequests: ["Anfrage A"],
      fairnessLabel: "Constanze und Dirk etwa gleich oft.",
      patterns: ["Sonntags Familienzeit"],
    });
    const p = renderPlanningPrompt(ctx);
    expect(p).toMatch(/Constanze und Dirk/);
    expect(p).toMatch(/## Termine/);
    expect(p).toMatch(/## Betreuung offen/);
    expect(p).toMatch(/## Offene Anfragen/);
    expect(p).toMatch(/## Fairness-Blick/);
    expect(p).toMatch(/Sonntags Familienzeit/);
  });

  it("zeigt frei/keine bei leerer Woche", () => {
    const p = renderPlanningPrompt(
      buildPlanningContext({
        todayLabel: "x",
        days: [{ weekday: "Mo", dayNumber: "1", events: [] }],
        openRequests: [],
        fairnessLabel: "y",
        patterns: [],
      }),
    );
    expect(p).toMatch(/keine offenen Punkte/);
  });
});
