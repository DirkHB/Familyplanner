"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { aiConfigured, getAnthropic, AI_MODEL } from "@/lib/ai/client";
import { smartCapture, type SmartItem, type SmartResult } from "@/lib/ai/smart-capture";
import { logAiFeedback } from "@/lib/ai/feedback";
import { createEvent } from "@/lib/calendar/create";
import { displayNameForEmail, personForEmail, type Person } from "@/lib/auth/allowlist";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { createTodo } from "@/lib/todos/repository";
import { addItem } from "@/lib/shopping/repository";
import { normalizeStore } from "@/lib/shopping/stores";

/** Ein Eingabefeld für alles: Termin, Aufgabe oder Einkauf — die KI ordnet zu. */
export async function captureAction(
  text: string,
): Promise<{ ok: true; result: SmartResult } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Nicht angemeldet." };
  if (!aiConfigured()) return { ok: false, error: "KI ist noch nicht konfiguriert (API-Key fehlt)." };
  if (!text.trim()) return { ok: false, error: "Bitte etwas eingeben." };
  const rl = rateLimit(`capture:${session.user.id}`, LIMITS.aiCapture.limit, LIMITS.aiCapture.windowMs);
  if (!rl.ok) return { ok: false, error: "Zu viele Anfragen. Versuch es in einer Weile noch einmal." };
  try {
    const result = await smartCapture(getAnthropic(), AI_MODEL, text.trim());
    return { ok: true, result };
  } catch {
    return { ok: false, error: "Konnte die Eingabe nicht verarbeiten." };
  }
}

/** Übernehmen: legt je nach Art Termin, Aufgabe oder Einkaufsartikel an. */
export async function acceptSuggestionAction(
  item: SmartItem,
): Promise<{ ok: boolean; created: boolean; reason?: string; where?: string }> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return { ok: false, created: false };
  const me = personForEmail(session.user.email);

  await logAiFeedback({
    suggestionId: `${item.kind}:${item.title}`,
    suggestionPayload: item,
    userId: session.user.id,
    action: "accepted",
  });

  try {
    if (item.kind === "einkauf") {
      await addItem(item.title, me, normalizeStore(item.store));
      revalidatePath("/einkauf");
      return { ok: true, created: true, where: "Einkaufsliste" };
    }

    if (item.kind === "aufgabe") {
      const due = item.dueDate ? new Date(`${item.dueDate}T09:00:00+02:00`) : null;
      const assignee: Person | null =
        item.assignee === "dirk" || item.assignee === "constanze" ? item.assignee : me;
      await createTodo({ title: item.title, notes: item.notes, dueDate: due, assignee, createdBy: me });
      revalidatePath("/aufgaben");
      return { ok: true, created: true, where: "Aufgaben" };
    }

    const res = await createEvent(session.user.id, {
      title: item.title,
      start: new Date(item.start),
      end: new Date(item.end || item.start),
      allDay: item.allDay,
      category: item.category,
      careNeeded: item.careNeeded,
      description: item.notes,
      createdBy: displayNameForEmail(session.user.email),
    });
    revalidatePath("/woche");
    revalidatePath("/termine");
    return { ok: true, created: res.created, reason: res.reason, where: "Kalender" };
  } catch {
    return { ok: true, created: false, reason: "Anlegen fehlgeschlagen." };
  }
}

export async function rejectSuggestionAction(item: SmartItem) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await logAiFeedback({
    suggestionId: `${item.kind}:${item.title}`,
    suggestionPayload: item,
    userId: session.user.id,
    action: "rejected",
  });
  return { ok: true };
}
