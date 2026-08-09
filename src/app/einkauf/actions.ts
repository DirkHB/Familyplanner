"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { meinPlatz } from "@/lib/haushalt/profil";
import { addItem, toggleItem, deleteItem, moveItemToStore, clearChecked } from "@/lib/shopping/repository";
import { storeIdFromGroupKey } from "@/lib/shopping/stores";

async function person() {
  const session = await auth();
  if (!session?.user?.email) return null;
  return meinPlatz(session.user.email);
}

export async function addItemAction(text: string, store?: string) {
  const p = await person();
  if (!p || !text.trim()) return { ok: false };
  await addItem(text, p, store ? storeIdFromGroupKey(store) : null);
  revalidatePath("/einkauf");
  return { ok: true };
}

export async function toggleItemAction(id: string) {
  const p = await person();
  if (!p) return { ok: false };
  await toggleItem(id, p);
  revalidatePath("/einkauf");
  return { ok: true };
}

export async function deleteItemAction(id: string) {
  const p = await person();
  if (!p) return { ok: false };
  await deleteItem(id);
  revalidatePath("/einkauf");
  return { ok: true };
}

/** Drag-and-drop: Artikel einem anderen Laden zuordnen. */
export async function moveItemAction(id: string, groupKey: string) {
  const p = await person();
  if (!p) return { ok: false };
  await moveItemToStore(id, groupKey);
  revalidatePath("/einkauf");
  return { ok: true };
}

/** „Alles erledigt": abgehakte Artikel sofort entfernen. */
export async function clearCheckedAction() {
  const p = await person();
  if (!p) return { ok: false };
  await clearChecked();
  revalidatePath("/einkauf");
  return { ok: true };
}
