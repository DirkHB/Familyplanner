/** Baut eine .ics für einen einzelnen Termin. UTC für Zeiten, reines Datum für all-day. */

export type NewEvent = {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string | null;
  description?: string | null;
  /**
   * Zusätzliche X-Eigenschaften, z. B. die Kennzeichnung eines
   * Betreuungsblocks. Apple Kalender ignoriert Unbekanntes, wir erkennen
   * unsere eigenen Einträge daran wieder.
   */
  xProps?: Record<string, string>;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function utcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function dateStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

/** RFC 5545 Text-Escaping. */
function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Zwei .ics-Texte vergleichbar machen.
 *
 * DTSTAMP ist der Moment, in dem der Text entstand — er ändert sich jede
 * Sekunde, auch wenn am Termin nichts anders ist. Wer zwei Fassungen
 * unbesehen vergleicht, findet deshalb IMMER einen Unterschied und schreibt
 * unaufhörlich nach iCloud. Das ist lange niemandem aufgefallen, weil die
 * Prüfung dafür beide Fassungen in derselben Sekunde erzeugte.
 */
export function ohneZeitstempel(ics: string): string {
  return ics
    .split(/\r?\n/)
    .filter((z) => !z.startsWith("DTSTAMP:"))
    .join("\r\n");
}

export function buildIcs(ev: NewEvent, now: Date = new Date()): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//planyourweek.app//DE",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `DTSTAMP:${utcStamp(now)}`,
  ];

  if (ev.allDay) {
    const endExclusive = new Date(ev.end.getTime());
    lines.push(`DTSTART;VALUE=DATE:${dateStamp(ev.start)}`);
    lines.push(`DTEND;VALUE=DATE:${dateStamp(endExclusive)}`);
  } else {
    lines.push(`DTSTART:${utcStamp(ev.start)}`);
    lines.push(`DTEND:${utcStamp(ev.end)}`);
  }

  lines.push(`SUMMARY:${esc(ev.title)}`);
  if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`);
  if (ev.description) lines.push(`DESCRIPTION:${esc(ev.description)}`);
  for (const [key, value] of Object.entries(ev.xProps ?? {})) {
    lines.push(`${key}:${esc(value)}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");

  // RFC 5545 verlangt CRLF-Zeilenenden.
  return lines.join("\r\n") + "\r\n";
}
