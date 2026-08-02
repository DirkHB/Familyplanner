import { berlinStunde } from "@/lib/calendar/zeitstrahl";
import { dayKey } from "@/lib/calendar/format";

/**
 * Wann „Frag ich heute Abend" fällig ist.
 *
 * Die Forschung zu Wenn-dann-Plänen (Gollwitzer/Sheeran) ist eindeutig: Ein
 * konkreter Zeitpunkt schlägt ein vages „irgendwann". Also: heute 18 Uhr —
 * es sei denn, der Termin ist früher. Dann muss die Frage klar davor liegen
 * (drei Stunden Vorlauf, damit Oma noch Ja sagen kann), und nie in der
 * Vergangenheit.
 */
export function frageFaellig(now: Date, terminStart: Date | null): Date {
  let due = berlinStunde(dayKey(now), 18);
  if (terminStart) {
    const vorlauf = new Date(terminStart.getTime() - 3 * 3_600_000);
    if (vorlauf < due) due = vorlauf;
  }
  if (due <= now) due = new Date(now.getTime() + 30 * 60_000);
  return due;
}
