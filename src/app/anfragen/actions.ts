"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createRequest,
  answerRequest,
  declineRequest,
  type RequestType,
} from "@/lib/requests/repository";

export async function answerRequestAction(id: string, answer: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await answerRequest(id, session.user.id, answer);
  revalidatePath("/woche");
  revalidatePath("/anfragen");
  return { ok: true };
}

export async function declineRequestAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await declineRequest(id, session.user.id);
  revalidatePath("/woche");
  revalidatePath("/anfragen");
  return { ok: true };
}

export async function createRequestAction(
  _prev: { error: string | null } | null,
  formData: FormData,
): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Nicht angemeldet." };

  const question = String(formData.get("question") ?? "").trim();
  const type = (String(formData.get("type") ?? "yes_no") as RequestType) || "yes_no";
  const optionsRaw = String(formData.get("options") ?? "").trim();
  const options = optionsRaw ? optionsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
  if (!question) return { error: "Bitte eine Frage eingeben." };

  try {
    await createRequest({ fromUserId: session.user.id, question, type, options });
    revalidatePath("/anfragen");
    revalidatePath("/woche");
    return { error: null };
  } catch {
    return { error: "Konnte die Anfrage nicht erstellen." };
  }
}
