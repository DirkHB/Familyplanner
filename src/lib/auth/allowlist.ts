/**
 * Zugang nur für genau unsere zwei Adressen (Constanze und Dirk).
 * Quelle: ALLOWED_EMAILS (kommagetrennt). Kein öffentliches Signup.
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

/** Anzeigename aus fester Zuordnung (Mockup-Sprache: Constanze zuerst). */
export function displayNameForEmail(email: string | null | undefined): string {
  const e = (email ?? "").trim().toLowerCase();
  if (e === "c.brederecke@gmail.com") return "Constanze";
  if (e === "dirkbrederecke@gmail.com") return "Dirk";
  return e.split("@")[0] || "Du";
}
