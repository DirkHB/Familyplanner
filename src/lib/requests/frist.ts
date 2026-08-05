import { dayKey } from "@/lib/calendar/format";

/**
 * Wann eine offene Anfrage keine Erinnerung mehr ist, sondern eine Frist.
 *
 * Der tägliche Nudge (09:00) fragt nach dem Alter: „liegt seit drei Tagen".
 * Das hilft nicht, wenn der Termin heute Abend ist — dann zählt nicht, wie
 * lange die Frage schon wartet, sondern wie wenig Zeit noch bleibt. Genau
 * diese Anfragen brauchen einen eigenen Anstoß.
 *
 * Reine Logik ohne Datenbank, damit die Ränder prüfbar sind: Der Termin darf
 * nicht schon vorbei sein, und zweimal am Tag anstoßen wollen wir nicht.
 */

/** Ab hier ist eine Entscheidung zeitnah nötig. */
export const FRIST_STUNDEN = 24;

export type FristInput = {
  status: string;
  /** Wann der Termin beginnt, um den es geht — oder das gesetzte „bis wann". */
  stichtag: Date | null;
  /** Wann zuletzt zu dieser Anfrage angestoßen wurde (Push oder Nudge). */
  lastNudgeAt: Date | null;
};

export type FristEntscheidung = {
  /** Jetzt anstoßen? */
  anstossen: boolean;
  /** Stunden bis zum Stichtag — für den Text der Mitteilung. */
  stundenBis: number | null;
};

export function evaluateFrist(req: FristInput, now: Date = new Date()): FristEntscheidung {
  if (req.status !== "open" || !req.stichtag) return { anstossen: false, stundenBis: null };

  const ms = req.stichtag.getTime() - now.getTime();
  const stundenBis = ms / 3_600_000;

  // Vorbei ist vorbei — eine Entscheidung für gestern hilft niemandem.
  if (ms <= 0) return { anstossen: false, stundenBis: null };
  if (stundenBis > FRIST_STUNDEN) return { anstossen: false, stundenBis };

  // Höchstens einmal am Tag je Anfrage. Wer mehrfach dasselbe liest, liest
  // bald gar nichts mehr.
  const heuteSchon = req.lastNudgeAt && dayKey(req.lastNudgeAt) === dayKey(now);
  return { anstossen: !heuteSchon, stundenBis };
}

/**
 * „heute 14:00" oder „morgen 09:00" — der Bezugspunkt gehört in die
 * Mitteilung, sonst muss man erst die App öffnen, um die Dringlichkeit zu
 * verstehen.
 */
export function fristLabel(stichtag: Date, now: Date = new Date()): string {
  const zeit = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  }).format(stichtag);
  const morgen = new Date(now.getTime() + 86_400_000);
  if (dayKey(stichtag) === dayKey(now)) return `heute ${zeit}`;
  if (dayKey(stichtag) === dayKey(morgen)) return `morgen ${zeit}`;
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  }).format(stichtag);
}
