import type { HaushaltProfil } from "./profil";

/**
 * Wer ist in diesem Haushalt Platz A und wer Platz B?
 *
 * Bis eben entschied das eine feste Adresse im Code: genau eine war „dirk",
 * jede andere wurde „constanze". Für uns ging das gut, weil wir genau die
 * beiden sind. In einem zweiten Haushalt wären damit beide dieselbe Person
 * gewesen — Aufgaben, Betreuung und Avatare wären auf einen Menschen
 * zusammengefallen.
 *
 * Jetzt kommt der Platz aus `users.slot`. Die beiden gespeicherten Werte sind
 * historisch gewachsen und stehen so in Aufgaben, Einkauf, Betreuung und
 * Verlauf. Sie bedeuten nichts mehr über die Person — nur „der erste" und
 * „der zweite". Umbenennen hieße, fünf Spalten auf einer laufenden Datenbank
 * anzufassen; der Gewinn wäre ein hübscherer String und sonst nichts.
 *
 * Deshalb: hier stehen sie einmal, überall sonst nur noch PLATZ_A und PLATZ_B.
 */

export type Platz = "dirk" | "constanze";

// `satisfies` statt `: Platz` — so bleibt der Literaltyp erhalten und die
// beiden taugen als Schlüssel eines Record<Platz, …>.
export const PLATZ_A = "dirk" satisfies Platz;
export const PLATZ_B = "constanze" satisfies Platz;

/** Die Reihenfolge, in der Plätze vergeben werden — Allowlist-Reihenfolge. */
export const PLAETZE: Platz[] = [PLATZ_A, PLATZ_B];

/** Der Platz, der einer Adresse in diesem Haushalt gehört. */
export function platzFuerEmail(
  profil: HaushaltProfil,
  email: string | null | undefined,
): Platz {
  const e = (email ?? "").trim().toLowerCase();
  const treffer = profil.erwachsene.find((p) => p.email === e);
  // Ohne Treffer der erste Platz: Das passiert nur, wenn jemand angemeldet
  // ist, der nicht mehr in der Allowlist steht — dann ist ohnehin etwas
  // anderes kaputt, und eine Zuordnung ist besser als ein Absturz.
  return (treffer?.slot as Platz) ?? PLATZ_A;
}

/** Die Adresse hinter einem Platz — für Benachrichtigungen und Zuweisungen. */
export function emailFuerPlatz(profil: HaushaltProfil, platz: Platz): string | null {
  return profil.erwachsene.find((p) => p.slot === platz)?.email ?? null;
}

/** Der jeweils andere. */
export function andererPlatz(platz: Platz): Platz {
  return platz === PLATZ_A ? PLATZ_B : PLATZ_A;
}

/**
 * Der Platz für die n-te Adresse der Allowlist. Nur für den Moment, in dem
 * ein Haushalt seine Nutzerzeilen zum ersten Mal anlegt.
 */
export function platzNachReihenfolge(index: number): Platz {
  return PLAETZE[index] ?? PLATZ_B;
}
