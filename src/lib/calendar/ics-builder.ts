/** Baut eine .ics für einen einzelnen Termin. UTC für Zeiten, reines Datum für all-day. */

export type NewEvent = {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string | null;
  description?: string | null;
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
  lines.push("END:VEVENT", "END:VCALENDAR");

  // RFC 5545 verlangt CRLF-Zeilenenden.
  return lines.join("\r\n") + "\r\n";
}
