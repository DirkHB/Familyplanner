/**
 * Wer darf sich anmelden? Quelle ist ALLOWED_EMAILS (kommagetrennt).
 * Kein öffentliches Signup, keine Selbstregistrierung.
 *
 * Wer wer IST — Name und Platz im Haushalt — steht nicht mehr hier, sondern
 * in der Datenbank (`lib/haushalt/profil.ts` und `lib/haushalt/platz.ts`).
 * Diese Datei kennt nur noch Adressen.
 */

export function parseAllowlist(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(
  email: string | null | undefined,
  raw: string | undefined = process.env.ALLOWED_EMAILS,
): boolean {
  if (!email) return false;
  const allow = parseAllowlist(raw);
  return allow.includes(email.trim().toLowerCase());
}

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
