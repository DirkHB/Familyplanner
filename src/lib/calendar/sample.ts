import type { Occurrence } from "./types";
import type { EventMeta } from "./view-model";
import { startOfDayBerlin, dayKey } from "./format";

/**
 * Beispiel-Woche für die öffentliche Vorschau (ohne DB/Sync). Spiegelt die Mockups,
 * damit Constanze und Dirk die Wochenansicht sehen, bevor der echte Kalender verbunden ist.
 */
export function buildSampleWeek(now: Date = new Date()): {
  occurrences: Occurrence[];
  metaByUid: Map<string, EventMeta>;
} {
  const base = startOfDayBerlin(now).getTime();
  const D = 86_400_000;
  const H = 3_600_000;
  const M = 60_000;

  const ev = (
    uid: string,
    summary: string,
    dayOff: number,
    h: number,
    m: number,
    durMin: number,
    location: string | null = null,
  ): Occurrence => {
    const start = new Date(base + dayOff * D + h * H + m * M);
    return {
      uid,
      summary,
      location,
      start,
      end: new Date(start.getTime() + durMin * M),
      allDay: false,
      startDate: null,
      recurrenceId: start.toISOString(),
      isException: false,
    };
  };

  const allDay = (uid: string, summary: string, dayOff: number): Occurrence => {
    const start = new Date(base + dayOff * D);
    return {
      uid,
      summary,
      location: null,
      start,
      end: new Date(start.getTime() + D),
      allDay: true,
      startDate: dayKey(start),
      recurrenceId: start.toISOString(),
      isException: false,
    };
  };

  const occurrences: Occurrence[] = [
    ev("s-physio", "Physio", 0, 9, 0, 50),
    ev("s-einkauf", "Einkauf", 0, 16, 30, 45),
    ev("s-arzt", "Kinderarzt · U3", 1, 10, 15, 45, "Praxis Dr. Behrens"),
    // Bewusst überlappend — die Vorschau muss parallele Termine zeigen.
    ev("s-friseur", "Friseur", 1, 10, 30, 60),
    ev("s-tennis", "Tennis", 2, 19, 0, 90),
    allDay("s-oma", "Geburtstag Oma", 3),
  ];

  const metaByUid = new Map<string, EventMeta>([
    ["s-physio", { category: "sport", care: { status: "geklaert" }, people: ["dirk"] }],
    ["s-einkauf", { category: "erledigung", care: { status: "offen" }, people: ["constanze"], openCount: 2 }],
    ["s-arzt", { category: "arzt", care: { status: "geklaert" }, people: ["constanze", "dirk"] }],
    ["s-friseur", { category: "erledigung", people: ["dirk"] }],
    ["s-tennis", { category: "sport", care: { status: "da", responsible: ["constanze"] }, people: ["dirk"] }],
    ["s-oma", { category: "geburtstag" }],
  ]);

  return { occurrences, metaByUid };
}
