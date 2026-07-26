import { dayKey } from "@/lib/calendar/format";

/**
 * Nudge- und Eskalationslogik für offene Anfragen (Abschnitt 6.3).
 * Ton neutral & freundlich — hier nur die Entscheidung, wann erinnert/eskaliert wird.
 *
 * Regeln:
 *  - Täglicher Push, solange offen (aber höchstens einmal pro Tag).
 *  - Nach 3 Tagen zusätzlich E-Mail.
 *  - Nach 7 Tagen im UI rot markieren (overdue).
 */

export type NudgeInput = {
  status: string; // "open" | "answered" | "declined"
  createdAt: Date;
  lastNudgeAt: Date | null;
};

export type NudgeDecision = {
  ageDays: number;
  shouldPushToday: boolean;
  shouldEmail: boolean;
  overdue: boolean;
};

const DAY = 86_400_000;

export function ageInDays(createdAt: Date, now: Date): number {
  return Math.floor((now.getTime() - createdAt.getTime()) / DAY);
}

/** Wird zur täglichen Nudge-Zeit ausgewertet (Worker) und für die UI-Markierung genutzt. */
export function evaluateNudge(req: NudgeInput, now: Date = new Date()): NudgeDecision {
  if (req.status !== "open") {
    return { ageDays: ageInDays(req.createdAt, now), shouldPushToday: false, shouldEmail: false, overdue: false };
  }
  const ageDays = ageInDays(req.createdAt, now);
  const notNudgedToday = !req.lastNudgeAt || dayKey(req.lastNudgeAt) !== dayKey(now);
  return {
    ageDays,
    shouldPushToday: notNudgedToday,
    shouldEmail: notNudgedToday && ageDays >= 3,
    overdue: ageDays >= 7,
  };
}

/** Nur die UI-Markierung (rot ab 7 Tagen) — ohne Nudge-Seiteneffekte. */
export function isOverdue(createdAt: Date, status: string, now: Date = new Date()): boolean {
  return status === "open" && ageInDays(createdAt, now) >= 7;
}
