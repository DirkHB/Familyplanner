import "server-only";
import { prisma } from "@/lib/prisma";
import { STORE_ORDER, STORE_LABEL, normalizeStore, type Store } from "./stores";
import type { Person } from "@/lib/auth/allowlist";

/** Gemeinsame Haupt-Einkaufsliste (Singleton), gruppiert nach Läden. */

const CHECKED_TTL_MS = 60 * 60_000; // abgehakte Artikel verschwinden nach ~1 h

export async function getOrCreateMainList() {
  const existing = await prisma.shoppingList.findFirst({ where: { kind: "haupt" } });
  if (existing) return existing;
  return prisma.shoppingList.create({ data: { kind: "haupt", name: "Einkaufsliste" } });
}

export type ItemVM = {
  id: string;
  text: string;
  checked: boolean;
  addedByPerson: Person | null;
};
export type GroupVM = { category: Store; label: string; items: ItemVM[] };

export async function getMainListGroups(): Promise<{ groups: GroupVM[]; openCount: number }> {
  const list = await getOrCreateMainList();

  // Aufräumen: länger als 1 h abgehakte Artikel still entfernen.
  await prisma.shoppingItem.deleteMany({
    where: { listId: list.id, checkedAt: { lt: new Date(Date.now() - CHECKED_TTL_MS) } },
  });

  const items = await prisma.shoppingItem.findMany({
    where: { listId: list.id },
    orderBy: [{ checkedAt: "asc" }, { createdAt: "asc" }],
  });

  const byStore = new Map<Store, ItemVM[]>(STORE_ORDER.map((s) => [s, []]));
  let openCount = 0;
  for (const it of items) {
    const store = normalizeStore(it.category);
    const vm: ItemVM = {
      id: it.id,
      text: it.text,
      checked: !!it.checkedAt,
      addedByPerson: (it.addedBy as Person) ?? null,
    };
    if (!vm.checked) openCount++;
    byStore.get(store)!.push(vm);
  }

  // Alle 5 Läden immer liefern (auch leer) — sie sind zugleich Drop-Ziele.
  const groups: GroupVM[] = STORE_ORDER.map((s) => ({
    category: s,
    label: STORE_LABEL[s],
    items: byStore.get(s)!,
  }));

  return { groups, openCount };
}

export async function addItem(text: string, addedBy: Person, store?: Store) {
  const list = await getOrCreateMainList();
  return prisma.shoppingItem.create({
    data: {
      listId: list.id,
      text: text.trim(),
      category: store ?? "sonstiges",
      addedBy,
    },
  });
}

/** Artikel per Drag-and-drop einem anderen Laden zuordnen. */
export async function moveItemToStore(id: string, store: Store) {
  return prisma.shoppingItem
    .update({ where: { id }, data: { category: normalizeStore(store) } })
    .catch(() => null);
}

/** „Alles erledigt": alle abgehakten Artikel sofort entfernen. */
export async function clearChecked() {
  const list = await getOrCreateMainList();
  return prisma.shoppingItem.deleteMany({
    where: { listId: list.id, checkedAt: { not: null } },
  });
}

export async function toggleItem(id: string, checkedBy: Person) {
  const item = await prisma.shoppingItem.findUnique({ where: { id } });
  if (!item) return null;
  const nowChecked = !item.checkedAt;
  return prisma.shoppingItem.update({
    where: { id },
    data: {
      checkedAt: nowChecked ? new Date() : null,
      checkedBy: nowChecked ? checkedBy : null,
    },
  });
}

export async function deleteItem(id: string) {
  return prisma.shoppingItem.delete({ where: { id } }).catch(() => null);
}

/* --------------------- Terminbezogene Einkaufslisten (Abschnitt 6.3) --------------------- */

/** Offene Items der Hauptliste, die noch keinem Termin zugeordnet sind — zum „Ziehen". */
export async function getLinkableItems(): Promise<{ id: string; text: string }[]> {
  const list = await getOrCreateMainList();
  const items = await prisma.shoppingItem.findMany({
    where: { listId: list.id, eventUid: null, checkedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, text: true },
  });
  return items;
}

/** Items, die diesem Termin zugeordnet sind (bleiben Teil der Hauptliste). */
export async function getEventItems(eventUid: string): Promise<ItemVM[]> {
  const items = await prisma.shoppingItem.findMany({
    where: { eventUid },
    orderBy: [{ checkedAt: "asc" }, { createdAt: "asc" }],
  });
  return items.map((it) => ({
    id: it.id,
    text: it.text,
    checked: !!it.checkedAt,
    addedByPerson: (it.addedBy as Person) ?? null,
  }));
}

export async function linkItemToEvent(id: string, eventUid: string) {
  return prisma.shoppingItem.update({ where: { id }, data: { eventUid } }).catch(() => null);
}

export async function unlinkItem(id: string) {
  return prisma.shoppingItem.update({ where: { id }, data: { eventUid: null } }).catch(() => null);
}

/** Neues Item direkt einem Termin zugeordnet anlegen (bleibt in der Hauptliste). */
export async function addItemToEvent(text: string, eventUid: string, addedBy: Person) {
  const list = await getOrCreateMainList();
  return prisma.shoppingItem.create({
    data: {
      listId: list.id,
      eventUid,
      text: text.trim(),
      category: "sonstiges",
      addedBy,
    },
  });
}
