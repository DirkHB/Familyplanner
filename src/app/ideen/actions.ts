"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { meinPlatz } from "@/lib/haushalt/profil";
import {
  createIdea,
  toggleVote,
  deleteIdea,
  markIdeaPlanned,
  type IdeaType,
} from "@/lib/ideas/repository";
import { createEvent } from "@/lib/calendar/create";

export async function createIdeaAction(
  _prev: { error: string | null } | null,
  formData: FormData,
): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Nicht angemeldet." };
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Bitte einen Titel eingeben." };
  await createIdea({
    type: String(formData.get("type") ?? "ausflug") as IdeaType,
    title,
    description: String(formData.get("description") ?? ""),
    imageUrl: String(formData.get("imageUrl") ?? ""),
    targetPeriod: String(formData.get("targetPeriod") ?? ""),
  });
  revalidatePath("/ideen");
  return { error: null };
}

export async function voteAction(id: string) {
  const session = await auth();
  if (!session?.user?.email) return;
  await toggleVote(id, await meinPlatz(session.user.email));
  revalidatePath("/ideen");
}

export async function deleteIdeaAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  await deleteIdea(id);
  revalidatePath("/ideen");
}

const TYPE_TO_CATEGORY: Record<string, string> = {
  restaurant: "besuch",
  geschenk: "geburtstag",
  urlaub: "sonstiges",
  ausflug: "sonstiges",
};

export async function convertIdeaAction(
  id: string,
  dateISO: string,
  title: string,
  type: string,
): Promise<{ ok: boolean; created: boolean; reason?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, created: false };
  const day = new Date(dateISO);
  if (isNaN(day.getTime())) return { ok: false, created: false, reason: "Ungültiges Datum." };

  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const end = new Date(start.getTime() + 86_400_000);
  try {
    const res = await createEvent(session.user.id, {
      title,
      start,
      end,
      allDay: true,
      category: TYPE_TO_CATEGORY[type] ?? "sonstiges",
    });
    if (res.created) await markIdeaPlanned(id);
    revalidatePath("/ideen");
    revalidatePath("/woche");
    return { ok: true, created: res.created, reason: res.reason };
  } catch {
    return { ok: true, created: false, reason: "Anlegen fehlgeschlagen." };
  }
}

export async function updateIdeaAction(
  id: string,
  input: { title: string; description: string; targetPeriod: string; imageUrl: string },
) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const { updateIdea } = await import("@/lib/ideas/repository");
  await updateIdea(id, input);
  revalidatePath("/ideen");
  return { ok: true };
}
