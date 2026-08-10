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

/**
 * Ein ganzer Zettel auf einmal — „Tomaten, Käse, Brot" oder eine Zeile je
 * Artikel, alles in dasselbe Geschäft.
 *
 * Das Zerlegen passiert auf dem Server, nicht im Browser: Die KI räumt dabei
 * auf, und ihr Schlüssel bleibt hier. Fällt sie aus, kommt die Liste trotzdem
 * an — dann eben so, wie sie getippt wurde.
 *
 * Zurück kommt, was wirklich angelegt wurde. Der Browser zeigt es an, statt
 * zu behaupten, es habe schon geklappt: Wer „Milch 1,5%, Brot" eintippt, will
 * sehen, dass daraus zwei Zeilen wurden und nicht drei.
 */
export async function addManyAction(
  text: string,
  store?: string,
): Promise<{ ok: boolean; artikel: string[]; grund?: string }> {
  const p = await person();
  if (!p) return { ok: false, artikel: [], grund: "Nicht angemeldet." };
  if (!text.trim()) return { ok: false, artikel: [], grund: "Da steht noch nichts." };

  const { zerlegeMitKi } = await import("@/lib/ai/einkauf-zerlegen");
  const { artikel } = await zerlegeMitKi(text);
  if (artikel.length === 0) {
    return { ok: false, artikel: [], grund: "Daraus konnte ich nichts machen." };
  }

  const ziel = store ? storeIdFromGroupKey(store) : null;
  for (const eintrag of artikel) {
    await addItem(eintrag, p, ziel);
  }
  revalidatePath("/einkauf");
  return { ok: true, artikel };
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
