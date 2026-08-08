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
/**
 * An welchen Tagen zeigt sich dieses Vorkommen?
 *
 * Fast immer an genau einem — dem seines Beginns. Ganztägiges kann sich aber
 * über mehrere Tage ziehen („Urlaub Italien, 10.–15."), und dann gehört es
 * auf jeden dieser Tage. Vorher stand es nur am 10. und war am 11. spurlos
 * verschwunden: genau an den Tagen weg, an denen es zählt.
 *
 * Nur für Ganztägiges. Ein Termin von 23 bis 1 Uhr ist ein Termin am
 * Vorabend, kein zweitägiger.
 */
export function tageEinesVorkommens(occ: Occurrence): string[] {
  if (!occ.allDay) return [dayKey(occ.start)];

  /*
   * Ganztägiges hat keinen Zeitpunkt, nur einen Tag — und genau deshalb darf
   * hier nicht mit dem Instant gerechnet werden: aus `DTSTART;VALUE=DATE:20260810`
   * macht ical.js Mitternacht in der Zeitzone des SERVERS. Unter UTC ist das
   * 10.08. 00:00Z, unter Europe/Berlin 09.08. 22:00Z. Beide Male ist es der 10.
   *
   * Zonenfest ist allein `startDate`, der reine Datums-String aus dem .ics.
   * Von dort wird in Kalendertagen weitergezählt; die Länge kommt aus der
   * Dauer, die sich bei einer Zonenverschiebung nicht ändert (das Runden
   * fängt die eine Stunde ab, die eine Sommerzeitgrenze dazwischenschiebt).
   */
  const erster = occ.startDate ?? dayKey(occ.start);
  // Endet exklusiv: DTSTART 10.08., DTEND 15.08. sind fünf Tage, der letzte ist der 14.
  const tageAnzahl = Math.max(1, Math.round((occ.end.getTime() - occ.start.getTime()) / 86_400_000));

  const tage: string[] = [];
  // Mittags-Anker in UTC: keine Sommerzeit, kein Kippen beim Weiterzählen.
  let zeiger = new Date(`${erster}T12:00:00Z`);
  // Deckel gegen kaputte .ics mit absurden Zeiträumen.
  for (let i = 0; i < Math.min(tageAnzahl, 366); i++) {
    tage.push(zeiger.toISOString().slice(0, 10));
    zeiger = new Date(zeiger.getTime() + 86_400_000);
  }
  return tage;
}

export function groupByDay(
  occurrences: Occurrence[],
  now: Date = new Date(),
  /**
   * Der abgefragte Zeitraum. Ohne ihn spannt ein mehrtägiges Ganztägiges die
   * Liste über seine eigene Länge auf — ein Eintrag „Sprung 2 (Woche 8–10)",
   * der vorletzten Mittwoch begann, ließ die Woche am Mittwoch anfangen,
   * drei Tage vor heute. Die Vorkommen wissen nichts davon, wonach gefragt
   * wurde; nur die aufrufende Stelle weiß es.
   */
  zeitraum?: { von: Date; bis: Date },
): DayGroup[] {
  const todayKey = dayKey(now);
  const vonKey = zeitraum ? dayKey(zeitraum.von) : null;
  // `bis` ist exklusiv — eine Millisekunde zurück trifft den letzten Tag.
  const bisKey = zeitraum ? dayKey(new Date(zeitraum.bis.getTime() - 1)) : null;
  const map = new Map<string, Occurrence[]>();

  for (const occ of occurrences) {
    for (const k of tageEinesVorkommens(occ)) {
      if (vonKey && k < vonKey) continue;
      if (bisKey && k > bisKey) continue;
      const list = map.get(k);
      if (list) list.push(occ);
      else map.set(k, [occ]);
    }
  }

  const groups: DayGroup[] = [];
  for (const [key, occs] of map) {
    occs.sort((a, b) => a.start.getTime() - b.start.getTime());
    // Der Tag beschreibt sich aus seinem Schlüssel, nicht aus dem ersten
    // Vorkommen: Ein Urlaub, der am 10. begann, stünde am 12. sonst als
    // „Montag, 10." da. Mittags-Anker gegen die Sommerzeit.
    const rep = new Date(`${key}T12:00:00Z`);
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
