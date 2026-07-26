/** Strukturierte Ausgabe der Schnellerfassung — Schema + Typen + Normalisierung. */

export type CaptureEvent = {
  title: string;
  allDay: boolean;
  start: string; // ISO-8601
  end: string; // ISO-8601
  category: string;
  careNeeded: boolean;
  checklist: string[];
  notes: string;
};

export type CaptureResult = { events: CaptureEvent[] };

const CATEGORIES = ["arzt", "sport", "besuch", "erledigung", "geburtstag", "sonstiges"];

/** JSON-Schema für output_config.format (strukturierte Ausgabe). */
export const CAPTURE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          allDay: { type: "boolean" },
          start: { type: "string" },
          end: { type: "string" },
          category: { type: "string", enum: CATEGORIES },
          careNeeded: { type: "boolean" },
          checklist: { type: "array", items: { type: "string" } },
          notes: { type: "string" },
        },
        required: ["title", "allDay", "start", "end", "category", "careNeeded", "checklist", "notes"],
      },
    },
  },
  required: ["events"],
} as const;

/** Robuste Normalisierung der Modell-Ausgabe (defensiv, nie werfen). */
export function normalizeCapture(raw: unknown): CaptureResult {
  const obj = (raw ?? {}) as { events?: unknown };
  const list = Array.isArray(obj.events) ? obj.events : [];
  const events: CaptureEvent[] = [];
  for (const item of list) {
    const e = (item ?? {}) as Partial<CaptureEvent>;
    if (!e.title || !e.start) continue;
    const category = CATEGORIES.includes(String(e.category)) ? String(e.category) : "sonstiges";
    events.push({
      title: String(e.title).slice(0, 200),
      allDay: !!e.allDay,
      start: String(e.start),
      end: String(e.end || e.start),
      category,
      careNeeded: !!e.careNeeded,
      checklist: Array.isArray(e.checklist) ? e.checklist.map(String).slice(0, 12) : [],
      notes: typeof e.notes === "string" ? e.notes : "",
    });
  }
  return { events };
}
