import type { Person } from "@/lib/auth/allowlist";

/**
 * Deskriptiver Fairness-Blick (Abschnitt 6.4): zählt übernommene Baby-Betreuung
 * je Person über einen Zeitraum. Rein beschreibend, nie wertend — die App zeigt
 * die Verteilung, urteilt aber nicht. Reine Funktion → unit-testbar.
 *
 * Reihenfolge in Texten immer „Constanze und Dirk" (Constanze zuerst).
 */

export type CareShareInput = { person: Person | null };

export type Fairness = {
  dirk: number;
  constanze: number;
  assigned: number; // Summe mit klarer Zuständigkeit
  open: number; // ohne Zuständigkeit
  constanzeShare: number; // 0..1 des Zugeordneten
  dirkShare: number;
  leaning: "constanze" | "dirk" | "balanced";
  label: string;
};

const BALANCED_MAX_DIFF = 0.15; // ≤15 %-Punkte Unterschied gilt als ausgeglichen

export function computeFairness(rows: CareShareInput[]): Fairness {
  let dirk = 0;
  let constanze = 0;
  let open = 0;
  for (const r of rows) {
    if (r.person === "dirk") dirk++;
    else if (r.person === "constanze") constanze++;
    else open++;
  }
  const assigned = dirk + constanze;
  const constanzeShare = assigned ? constanze / assigned : 0;
  const dirkShare = assigned ? dirk / assigned : 0;

  let leaning: Fairness["leaning"] = "balanced";
  if (assigned >= 2 && Math.abs(constanzeShare - dirkShare) > BALANCED_MAX_DIFF) {
    leaning = constanze > dirk ? "constanze" : "dirk";
  }

  return {
    dirk,
    constanze,
    assigned,
    open,
    constanzeShare,
    dirkShare,
    leaning,
    label: labelFor(constanze, dirk, assigned, leaning),
  };
}

function labelFor(
  constanze: number,
  dirk: number,
  assigned: number,
  leaning: Fairness["leaning"],
): string {
  if (assigned === 0) return "Noch keine Betreuung erfasst.";
  if (leaning === "balanced") return `Gut verteilt — Constanze und Dirk etwa gleich oft.`;
  if (leaning === "constanze")
    return `Constanze hat zuletzt öfter übernommen (${constanze} zu ${dirk}).`;
  return `Dirk hat zuletzt öfter übernommen (${dirk} zu ${constanze}).`;
}
