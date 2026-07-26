/**
 * Ruhezeiten (Nachtfenster) — mit Neugeborenem nicht verhandelbar (Abschnitt 6.4).
 * Vergleich in Berliner Ortszeit. Unterstützt Fenster über Mitternacht (z. B. 21:00–07:00).
 */

const berlinTime = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Berlin",
});

export function minutesOfDayBerlin(d: Date): number {
  const [h, m] = berlinTime.format(d).split(":").map(Number);
  return h * 60 + m;
}

function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function isQuietHours(
  now: Date,
  quietStart = "21:00",
  quietEnd = "07:00",
): boolean {
  const cur = minutesOfDayBerlin(now);
  const start = parseHHMM(quietStart);
  const end = parseHHMM(quietEnd);
  if (start === end) return false; // kein Fenster
  if (start < end) {
    // gleiches Tagesfenster, z. B. 13:00–14:00
    return cur >= start && cur < end;
  }
  // über Mitternacht, z. B. 21:00–07:00
  return cur >= start || cur < end;
}

export type NotificationPrefs = {
  requests: boolean;
  eventReminders: boolean;
  careGaps: boolean;
  weeklyPlanning: boolean;
  quietStart: string;
  quietEnd: string;
};

export const DEFAULT_PREFS: NotificationPrefs = {
  requests: true,
  eventReminders: true,
  careGaps: true,
  weeklyPlanning: true,
  quietStart: "21:00",
  quietEnd: "07:00",
};

export function mergePrefs(raw: unknown): NotificationPrefs {
  const p = (raw ?? {}) as Partial<NotificationPrefs>;
  return { ...DEFAULT_PREFS, ...p };
}
