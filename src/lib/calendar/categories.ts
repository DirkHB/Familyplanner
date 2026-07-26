/** Kategorien nach Briefing (6.1). Farbe sparsam — Türkis bleibt der seltene Akzent. */

export type CategoryKey =
  | "arzt"
  | "sport"
  | "besuch"
  | "erledigung"
  | "geburtstag"
  | "sonstiges";

type CategoryDef = { key: CategoryKey; label: string; dotColor: string };

export const CATEGORIES: Record<CategoryKey, CategoryDef> = {
  arzt: { key: "arzt", label: "Arzt", dotColor: "var(--color-accent)" },
  sport: { key: "sport", label: "Sport", dotColor: "var(--color-ink)" },
  besuch: { key: "besuch", label: "Besuch", dotColor: "var(--color-counter)" },
  erledigung: { key: "erledigung", label: "Erledigung", dotColor: "var(--color-ink-muted)" },
  geburtstag: { key: "geburtstag", label: "Geburtstag", dotColor: "var(--color-counter)" },
  sonstiges: { key: "sonstiges", label: "Sonstiges", dotColor: "var(--color-ink-muted)" },
};

export function categoryOf(raw: string | null | undefined): CategoryDef {
  const k = (raw ?? "").toLowerCase() as CategoryKey;
  return CATEGORIES[k] ?? CATEGORIES.sonstiges;
}

/** Leichte Heuristik für die Auto-Kategorie aus dem Titel (nur Vorschlag, überschreibbar). */
export function guessCategory(title: string): CategoryKey {
  const t = title.toLowerCase();
  if (/arzt|ärztin|praxis|zahn|u\d|impf|kinderarzt|klinik/.test(t)) return "arzt";
  if (/tennis|sport|gym|physio|lauf|yoga|schwimm/.test(t)) return "sport";
  if (/besuch|oma|opa|treffen|kaffee|brunch/.test(t)) return "besuch";
  if (/einkauf|erledig|abhol|paket|apotheke|bank/.test(t)) return "erledigung";
  if (/geburtstag|geburt|jubiläum/.test(t)) return "geburtstag";
  return "sonstiges";
}
