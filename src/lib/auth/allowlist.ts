/**
 * Was von der Zugangsliste übrig ist: ein Notname.
 *
 * Wer sich anmelden darf, stand hier einmal als Liste in einer
 * Umgebungsvariablen. Das ist vorbei — die Antwort gibt jetzt die Einladung
 * (`lib/einladung/store.ts`), und wer wer IST, steht in der Datenbank
 * (`lib/haushalt/profil.ts`, `lib/haushalt/platz.ts`).
 */

/**
 * Notname aus der Adresse — „thomas@example.com" wird „Thomas".
 *
 * Nur ein Platzhalter für die Lücke zwischen dem ersten Login und dem Moment,
 * in dem jemand im Assistenten seinen Namen einträgt. Überall, wo ein echter
 * Name vorliegt, hat der Vorrang: `user.name ?? notnameAusEmail(user.email)`.
 */
export function notnameAusEmail(email: string | null | undefined): string {
  const lokal = (email ?? "").trim().toLowerCase().split("@")[0];
  if (!lokal) return "Du";
  // Punkte und Striche trennen meist Vor- und Nachname.
  const wort = lokal.split(/[._-]/)[0];
  return wort.charAt(0).toUpperCase() + wort.slice(1);
}
