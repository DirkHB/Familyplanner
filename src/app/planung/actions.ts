"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { aiConfigured } from "@/lib/ai/client";
import { runWeeklyPlan } from "@/lib/ai/weekly-plan-runner";
import type { WeeklyPlan } from "@/lib/ai/weekly-plan";
import {
  createPattern,
  togglePattern,
  updatePatternLabel,
  deletePattern,
} from "@/lib/patterns/repository";

export async function generatePlanAction(): Promise<
  { ok: true; plan: WeeklyPlan } | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Nicht angemeldet." };
  if (!aiConfigured()) return { ok: false, error: "KI ist noch nicht konfiguriert (API-Key fehlt)." };
  try {
    const plan = await runWeeklyPlan(session.user.id);
    return { ok: true, plan };
  } catch {
    return { ok: false, error: "Planung fehlgeschlagen. Versuch es später noch einmal." };
  }
}

export async function addPatternAction(_prev: { error: string | null } | null, fd: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Nicht angemeldet." };
  const label = String(fd.get("label") ?? "").trim();
  if (!label) return { error: "Bitte etwas eingeben." };
  await createPattern(label);
  revalidatePath("/planung");
  return { error: null };
}

export async function togglePatternAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  await togglePattern(id);
  revalidatePath("/planung");
}

export async function updatePatternAction(id: string, label: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  await updatePatternLabel(id, label);
  revalidatePath("/planung");
}

export async function deletePatternAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  await deletePattern(id);
  revalidatePath("/planung");
}
