import { startOfDayBerlin, dayKey } from "@/lib/calendar/format";

/** Zeitfenster des Überblicks — rein, ohne DB, damit testbar. */

export type Horizon = "bis-sonntag" | "naechste-woche";

/** Wochentag in Berliner Zeit: 0 = Montag … 6 = Sonntag. */
export function berlinWeekday(now: Date): number {
  // Über den Berliner Kalendertag rechnen — der UTC-Instant der Berliner
  // Mitternacht liegt im Sommer im Vortag und würde sonst danebenliegen.
  const d = new Date(`${dayKey(now)}T12:00:00Z`);
  return (d.getUTCDay() + 6) % 7;
}

function berlinHour(now: Date): number {
  return Number(
    new Intl.DateTimeFormat("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/Berlin",
    })
      .format(now)
      .split(":")[0],
  );
}

/**
 * Welcher Zeitraum ist gemeint? Bis Sonntag 12:00 die laufende Woche,
 * danach die komplette nächste — der Rest des Sonntags ist nur noch Ausklang.
 */
export function defaultHorizon(now: Date): Horizon {
  return berlinWeekday(now) === 6 && berlinHour(now) >= 12 ? "naechste-woche" : "bis-sonntag";
}

/**
 * Der Überblick zeigt immer nur, was noch kommt — beginnt also **jetzt**,
 * nicht heute früh. Ende ist Sonntag 24:00 Berliner Zeit.
 *
 * Sonderfall Sonntagmittag: Sobald automatisch auf die nächste Woche
 * umgeschaltet wird, bleibt der **Rest des Sonntags** sichtbar — der Tag ist
 * ja noch nicht vorbei. Blättert man an einem anderen Tag bewusst voraus,
 * beginnt die nächste Woche sauber am Montag.
 */
export function horizonRange(kind: Horizon, now: Date): { from: Date; to: Date } {
  const today = startOfDayBerlin(now);
  const dow = berlinWeekday(now);
  const endOfSunday = new Date(today.getTime() + (7 - dow) * 86_400_000);

  if (kind === "bis-sonntag") return { from: now, to: endOfSunday };

  const rolledOverAutomatically = defaultHorizon(now) === "naechste-woche";
  return {
    from: rolledOverAutomatically ? now : endOfSunday,
    to: new Date(endOfSunday.getTime() + 7 * 86_400_000),
  };
}
