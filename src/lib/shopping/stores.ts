/** Einkaufs-Bereiche = eure Läden (statt Warengruppen): frei per Drag-and-drop sortierbar. */

export const STORE_ORDER = ["lidl", "ali", "edeka", "kaefer", "sonstiges"] as const;
export type Store = (typeof STORE_ORDER)[number];

export const STORE_LABEL: Record<Store, string> = {
  lidl: "Lidl",
  ali: "Ali",
  edeka: "Edeka",
  kaefer: "Käfer",
  sonstiges: "Sonstiges",
};

export function normalizeStore(raw: unknown): Store {
  return STORE_ORDER.includes(raw as Store) ? (raw as Store) : "sonstiges";
}
