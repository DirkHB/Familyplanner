import { describe, it, expect } from "vitest";
import { formatTime, formatWeekday, dayKey, groupByDay } from "./format";
import type { Occurrence } from "./types";

function occ(startIso: string, summary = "X"): Occurrence {
  const start = new Date(startIso);
  return {
    uid: summary,
    summary,
    location: null,
    start,
    end: new Date(start.getTime() + 3600_000),
    allDay: false,
    startDate: null,
    recurrenceId: startIso,
    isException: false,
  };
}

describe("format (Europe/Berlin)", () => {
  it("zeigt UTC-Instant in Berliner Zeit (Sommerzeit +2h)", () => {
    expect(formatTime(new Date("2026-07-28T08:15:00Z"))).toBe("10:15");
  });

  it("zeigt Winterzeit (+1h)", () => {
    expect(formatTime(new Date("2026-01-15T08:15:00Z"))).toBe("09:15");
  });

  it("Wochentag deutsch", () => {
    // 2026-07-27 ist ein Montag
    expect(formatWeekday(new Date("2026-07-27T09:00:00Z"))).toBe("Montag");
  });

  it("dayKey nutzt Berliner Tagesgrenze", () => {
    // 22:30Z im Sommer = 00:30 Berlin am Folgetag
    expect(dayKey(new Date("2026-07-27T22:30:00Z"))).toBe("2026-07-28");
  });
});

describe("groupByDay", () => {
  it("gruppiert und sortiert chronologisch", () => {
    const groups = groupByDay(
      [occ("2026-07-28T14:00:00Z", "B"), occ("2026-07-27T07:00:00Z", "A"), occ("2026-07-28T06:00:00Z", "C")],
      new Date("2026-07-27T10:00:00Z"),
    );
    expect(groups.map((g) => g.key)).toEqual(["2026-07-27", "2026-07-28"]);
    expect(groups[0].isToday).toBe(true);
    expect(groups[1].isToday).toBe(false);
    // innerhalb des Tages sortiert
    expect(groups[1].occurrences.map((o) => o.summary)).toEqual(["C", "B"]);
  });
});
