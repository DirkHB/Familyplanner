import "server-only";
import { prisma } from "@/lib/prisma";
import {
  guessShoppingCategory,
  SHOPPING_CATEGORY_ORDER,
  SHOPPING_CATEGORY_LABEL,
  type ShoppingCategory,
} from "./categories";
import type { Person } from "@/lib/auth/allowlist";

/** Gemeinsame Haupt-Einkaufsliste (Singleton) + terminbezogene Listen (später). */

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
export type GroupVM = { category: ShoppingCategory; label: string; items: ItemVM[] };

export async function getMainListGroups(): Promise<{ groups: GroupVM[]; openCount: number }> {
  const list = await getOrCreateMainList();
  const items = await prisma.shoppingItem.findMany({
    where: { listId: list.id },
    orderBy: [{ checkedAt: "asc" }, { createdAt: "asc" }],
  });

  const byCat = new Map<ShoppingCategory, ItemVM[]>();
  let openCount = 0;
  for (const it of items) {
    const cat = (it.category as ShoppingCategory) ?? "sonstiges";
    const vm: ItemVM = {
      id: it.id,
      text: it.text,
      checked: !!it.checkedAt,
      addedByPerson: (it.addedBy as Person) ?? null,
    };
    if (!vm.checked) openCount++;
    const arr = byCat.get(cat) ?? [];
    arr.push(vm);
    byCat.set(cat, arr);
  }

  const groups: GroupVM[] = SHOPPING_CATEGORY_ORDER.filter((c) => byCat.get(c)?.length).map((c) => ({
    category: c,
    label: SHOPPING_CATEGORY_LABEL[c],
    items: byCat.get(c)!,
  }));

  return { groups, openCount };
}

export async function addItem(text: string, addedBy: Person, category?: ShoppingCategory) {
  const list = await getOrCreateMainList();
  return prisma.shoppingItem.create({
    data: {
      listId: list.id,
      text: text.trim(),
      category: category ?? guessShoppingCategory(text),
      addedBy,
    },
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
