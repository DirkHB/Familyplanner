import type { Occurrence } from "./types";

/** Anzeige in Europe/Berlin, Speicherung immer UTC. Nutzt eingebautes Intl (keine tz-Lib). */

const TZ = "Europe/Berlin";

const timeFmt = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TZ,
});
const weekdayFmt = new Intl.DateTimeFormat("de-DE", { weekday: "long", timeZone: TZ });
const dayNumFmt = new Intl.DateTimeFormat("de-DE", { day: "numeric", timeZone: TZ });
const monthDayFmt = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "long",
  timeZone: TZ,
});
// YYYY-MM-DD in Berliner Zeit (sv-SE liefert ISO-Reihenfolge).
const keyFmt = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TZ,
});

export function formatTime(d: Date): string {
  return timeFmt.format(d);
}
export function formatWeekday(d: Date): string {
  return weekdayFmt.format(d);
}
export function formatDayNumber(d: Date): string {
  return dayNumFmt.format(d);
}
export function formatMonthDay(d: Date): string {
  return monthDayFmt.format(d);
}
export function dayKey(d: Date): string {
  return keyFmt.format(d);
}

/** UTC-Instant der Berliner Mitternacht des Tages von `now` (DST-sicher). */
/**
 * „heute, 16:00", „morgen, 09:00", „Di, 4. August, 16:00".
 *
 * Der Bezugspunkt für alles, was zur Entscheidung ansteht: Karten im
 * Klärungs-Stapel, die Anfrage auf der Woche, die Anfragen-Liste. Er gehört
 * an eine Stelle — sonst sagt eine Ansicht „morgen" und die nächste
 * „Di, 4. August" für denselben Termin.
 */
export function wannLabel(start: Date, allDay: boolean, now: Date = new Date()): string {
  const k = dayKey(start);
  // Mittags-Anker: über die Sommerzeitgrenze kippt sonst der Tag.
  const morgenKey = dayKey(new Date(startOfDayBerlin(now).getTime() + 86_400_000 + 43_200_000));
  const tag =
    k === dayKey(now)
      ? "heute"
      : k === morgenKey
        ? "morgen"
        : `${formatWeekday(start).slice(0, 2)}, ${formatMonthDay(start)}`;
  return allDay ? tag : `${tag}, ${formatTime(start)}`;
}

export function startOfDayBerlin(now: Date = new Date()): Date {
  const key = keyFmt.format(now);
  for (const off of ["+02:00", "+01:00"]) {
    const d = new Date(`${key}T00:00:00${off}`);
    if (keyFmt.format(d) === key && timeFmt.format(d) === "00:00") return d;
  }
  return new Date(`${key}T00:00:00Z`);
}

/** Kopfzeile der Wochenansicht, z. B. "Montag, 27. Juli". */
export function formatDateHeader(d: Date = new Date()): string {
  return `${weekdayFmt.format(d)}, ${monthDayFmt.format(d)}`;
}

/** Tageszeitabhängige Begrüßung (Berliner Zeit).
 *  Stunde robust über das HH:MM-Format ermitteln — `hour: "numeric"` liefert
 *  auf manchen ICU-Versionen "17 Uhr", was Number() zu NaN macht. */
export function greetingFor(d: Date = new Date()): string {
  const h = Number(timeFmt.format(d).split(":")[0]);
  if (h >= 5 && h < 11) return "Guten Morgen";
  if (h >= 11 && h < 17) return "Hallo";
  if (h >= 17 && h < 22) return "Guten Abend";
  return "Gute Nacht";
}

export type DayGroup = {
  key: string; // YYYY-MM-DD (Berlin)
  date: Date; // Instant zum Tagesbeginn (repräsentativ)
  weekday: string;
  dayNumber: string;
  isToday: boolean;
  occurrences: Occurrence[];
};

/** Vorkommen nach Berliner Kalendertag gruppieren, chronologisch sortiert. */
export function groupByDay(occurrences: Occurrence[], now: Date = new Date()): DayGroup[] {
  const todayKey = dayKey(now);
  const map = new Map<string, Occurrence[]>();

  for (const occ of occurrences) {
    const k = dayKey(occ.start);
    const list = map.get(k);
    if (list) list.push(occ);
    else map.set(k, [occ]);
  }

  const groups: DayGroup[] = [];
  for (const [key, occs] of map) {
    occs.sort((a, b) => a.start.getTime() - b.start.getTime());
    const rep = occs[0].start;
    groups.push({
      key,
      date: rep,
      weekday: formatWeekday(rep),
      dayNumber: formatDayNumber(rep),
      isToday: key === todayKey,
      occurrences: occs,
    });
  }
  groups.sort((a, b) => a.key.localeCompare(b.key));
  return groups;
}
