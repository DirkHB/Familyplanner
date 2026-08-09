import "server-only";
import { prisma } from "@/lib/prisma";
import {
  OHNE_LADEN,
  OHNE_LADEN_LABEL,
  groupKeyFor,
  storeIdFromGroupKey,
  normalizeName,
  nameVergeben,
} from "./stores";
import type { Platz as Person } from "@/lib/haushalt/platz";
import { hauptliste } from "@/lib/haushalt/singletons";

/** Gemeinsame Haupt-Einkaufsliste (Singleton), gruppiert nach Läden. */

const CHECKED_TTL_MS = 60 * 60_000; // abgehakte Artikel verschwinden nach ~1 h

/** Die Hauptliste dieses Haushalts — die Frage „welche?" wohnt in haushalt/. */
export async function getOrCreateMainList() {
  return hauptliste();
}

export type ItemVM = {
  id: string;
  text: string;
  checked: boolean;
  addedByPerson: Person | null;
};
/** `category` ist die Gruppen-Kennung: eine Laden-Id oder `OHNE_LADEN`. */
export type GroupVM = { category: string; label: string; items: ItemVM[] };

export async function listStores() {
  return prisma.store.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
}

/**
 * Einen Laden über seinen Namen finden — für alles, was nur einen Namen kennt
 * (die KI-Erfassung zum Beispiel). Kein Treffer heißt „Sonstiges", nicht
 * „Fehler": Ein Artikel darf nie daran scheitern, dass der Laden unbekannt ist.
 */
export async function resolveStoreByName(name: unknown): Promise<string | null> {
  if (typeof name !== "string" || !name.trim()) return null;
  const gesucht = normalizeName(name).toLowerCase();
  const treffer = (await listStores()).find(
    (s) => normalizeName(s.name).toLowerCase() === gesucht,
  );
  return treffer?.id ?? null;
}

export async function getMainListGroups(): Promise<{ groups: GroupVM[]; openCount: number }> {
  const list = await getOrCreateMainList();

  // Aufräumen: länger als 1 h abgehakte Artikel still entfernen.
  await prisma.shoppingItem.deleteMany({
    where: { listId: list.id, checkedAt: { lt: new Date(Date.now() - CHECKED_TTL_MS) } },
  });

  const [items, stores] = await Promise.all([
    prisma.shoppingItem.findMany({
      where: { listId: list.id },
      orderBy: [{ checkedAt: "asc" }, { createdAt: "asc" }],
    }),
    listStores(),
  ]);

  const byStore = new Map<string, ItemVM[]>(stores.map((s) => [s.id, []]));
  byStore.set(OHNE_LADEN, []);
  let openCount = 0;
  for (const it of items) {
    const key = groupKeyFor(it.storeId);
    const vm: ItemVM = {
      id: it.id,
      text: it.text,
      checked: !!it.checkedAt,
      addedByPerson: (it.addedBy as Person) ?? null,
    };
    if (!vm.checked) openCount++;
    // Ein Laden, den es nicht mehr gibt, darf keinen Artikel verschlucken.
    (byStore.get(key) ?? byStore.get(OHNE_LADEN)!).push(vm);
  }

  // Alle Läden immer liefern (auch leer) — sie sind zugleich Ablegeziele.
  // „Sonstiges" steht am Ende und ist nie weg.
  const groups: GroupVM[] = [
    ...stores.map((s) => ({ category: s.id, label: s.name, items: byStore.get(s.id)! })),
    { category: OHNE_LADEN, label: OHNE_LADEN_LABEL, items: byStore.get(OHNE_LADEN)! },
  ];

  return { groups, openCount };
}

/* ------------------------------ Läden pflegen ------------------------------ */

export async function createStore(name: string): Promise<{ ok: boolean; grund?: string }> {
  const sauber = normalizeName(name);
  if (!sauber) return { ok: false, grund: "Der Laden braucht einen Namen." };
  const vorhandene = await listStores();
  if (nameVergeben(sauber, vorhandene.map((s) => s.name)))
    return { ok: false, grund: `„${sauber}" gibt es schon.` };
  const letzte = vorhandene[vorhandene.length - 1];
  await prisma.store.create({
    data: { name: sauber, sortOrder: (letzte?.sortOrder ?? -1) + 1 },
  });
  return { ok: true };
}

export async function renameStore(id: string, name: string): Promise<{ ok: boolean; grund?: string }> {
  const sauber = normalizeName(name);
  if (!sauber) return { ok: false, grund: "Der Laden braucht einen Namen." };
  const vorhandene = await listStores();
  const andere = vorhandene.filter((s) => s.id !== id);
  if (nameVergeben(sauber, andere.map((s) => s.name)))
    return { ok: false, grund: `„${sauber}" gibt es schon.` };
  await prisma.store.update({ where: { id }, data: { name: sauber } }).catch(() => null);
  return { ok: true };
}

/**
 * Laden löschen. Die Artikel bleiben — sie rutschen nach „Sonstiges", weil die
 * Fremdschlüssel auf NULL gehen. Einen Einkaufszettel beim Umbenennen eines
 * Ladens zu leeren wäre die schlechteste denkbare Überraschung.
 */
export async function deleteStore(id: string) {
  return prisma.store.delete({ where: { id } }).catch(() => null);
}

export async function addItem(text: string, addedBy: Person, storeId?: string | null) {
  const list = await getOrCreateMainList();
  const item = await prisma.shoppingItem.create({
    data: {
      listId: list.id,
      text: text.trim(),
      storeId: storeId ?? null,
      addedBy,
    },
  });
  // Kaufhistorie fürs Vorschlags-Feature (Items selbst verschwinden nach dem Abhaken).
  await prisma.activityLog
    .create({
      data: { entityType: "shopping", entityId: list.id, action: "add", actor: addedBy, detail: { text: item.text } },
    })
    .catch(() => null);
  return item;
}

/** „Übliche Verdächtige": meistgekaufte Artikel, die gerade nicht offen auf der Liste stehen. */
export async function getFrequentSuggestions(limit = 8): Promise<string[]> {
  const list = await getOrCreateMainList();
  const [logs, open] = await Promise.all([
    prisma.activityLog.findMany({
      where: { entityType: "shopping", action: "add" },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { detail: true },
    }),
    prisma.shoppingItem.findMany({
      where: { listId: list.id, checkedAt: null },
      select: { text: true },
    }),
  ]);

  const onList = new Set(open.map((i) => i.text.trim().toLowerCase()));
  const counts = new Map<string, { text: string; n: number }>();
  for (const l of logs) {
    const text = String((l.detail as { text?: string })?.text ?? "").trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (onList.has(key)) continue;
    const cur = counts.get(key);
    if (cur) cur.n++;
    else counts.set(key, { text, n: 1 });
  }
  return [...counts.values()]
    .filter((c) => c.n >= 2)
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((c) => c.text);
}

/** Artikel per Drag-and-drop einem anderen Laden zuordnen. */
export async function moveItemToStore(id: string, groupKey: string) {
  return prisma.shoppingItem
    .update({ where: { id }, data: { storeId: storeIdFromGroupKey(groupKey) } })
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
      // Ohne Laden — das Fach „Sonstiges". Wer es beim Termin einträgt, denkt
      // an den Termin, nicht an den Laden.
      storeId: null,
      addedBy,
    },
  });
}
