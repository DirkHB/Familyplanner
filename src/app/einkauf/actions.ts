"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { personForEmail } from "@/lib/auth/allowlist";
import { addItem, toggleItem, deleteItem } from "@/lib/shopping/repository";

async function person() {
  const session = await auth();
  if (!session?.user?.email) return null;
  return personForEmail(session.user.email);
}

export async function addItemAction(text: string) {
  const p = await person();
  if (!p || !text.trim()) return { ok: false };
  await addItem(text, p);
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
