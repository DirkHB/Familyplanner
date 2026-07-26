/** Normalisierte Kalender-Typen. Alles in UTC; all-day trägt zusätzlich das reine Datum. */

export type ParsedEvent = {
  uid: string;
  summary: string;
  location: string | null;
  description: string | null;
  start: Date; // UTC-Instant
  end: Date; // UTC-Instant
  allDay: boolean;
  /** Reines Datum (YYYY-MM-DD) bei all-day — nicht als Mitternacht-Zeitstempel behandeln. */
  startDate: string | null;
  rrule: string | null;
  /** Gesetzt, wenn dieses VEVENT eine Einzelausnahme (RECURRENCE-ID) einer Serie ist. */
  recurrenceId: string | null;
  isOverride: boolean;
};

export type Occurrence = {
  uid: string;
  summary: string;
  location: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  startDate: string | null;
  /** ISO der ursprünglichen Serienzeit dieses Vorkommens (Serien-Identität). */
  recurrenceId: string;
  /** true, wenn dieses Vorkommen durch eine RECURRENCE-ID-Ausnahme verändert wurde. */
  isException: boolean;
};
