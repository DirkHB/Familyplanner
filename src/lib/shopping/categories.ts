/** Einkaufs-Kategorien nach Ladenlayout (Abschnitt 6.2). Reihenfolge = Anzeigereihenfolge. */

export type ShoppingCategory = "frisches" | "baby" | "haushalt" | "vorrat" | "sonstiges";

export const SHOPPING_CATEGORY_ORDER: ShoppingCategory[] = [
  "frisches",
  "baby",
  "vorrat",
  "haushalt",
  "sonstiges",
];

export const SHOPPING_CATEGORY_LABEL: Record<ShoppingCategory, string> = {
  frisches: "Frisches",
  baby: "Baby",
  vorrat: "Vorrat",
  haushalt: "Haushalt",
  sonstiges: "Sonstiges",
};

/** Leichte Heuristik — nur ein Vorschlag, im UI überschreibbar. */
export function guessShoppingCategory(text: string): ShoppingCategory {
  const t = text.toLowerCase();
  if (/windel|feucht|brei|milch|schnuller|baby|pucksack|fläsch/.test(t)) return "baby";
  if (/obst|gemüse|banan|apfel|salat|milch|joghurt|käse|brot|fleisch|fisch|ei\b|eier|beeren|haferdrink/.test(t))
    return "frisches";
  if (/spül|putz|wasch|müllbeutel|klopapier|toiletten|reiniger|schwamm|tabs/.test(t)) return "haushalt";
  if (/nudel|reis|mehl|zucker|öl|konserve|kaffee|tee|salz|pasta/.test(t)) return "vorrat";
  return "sonstiges";
}
