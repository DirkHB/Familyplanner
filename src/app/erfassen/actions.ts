"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { aiConfigured } from "@/lib/ai/client";
import { quickCapture } from "@/lib/ai/quick-capture";
import { logAiFeedback } from "@/lib/ai/feedback";
import { createEvent } from "@/lib/calendar/create";
import { displayNameForEmail } from "@/lib/auth/allowlist";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import type { CaptureEvent, CaptureResult } from "@/lib/ai/schemas";

export async function captureAction(
  text: string,
): Promise<{ ok: true; result: CaptureResult } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Nicht angemeldet." };
  if (!aiConfigured()) return { ok: false, error: "KI ist noch nicht konfiguriert (API-Key fehlt)." };
  if (!text.trim()) return { ok: false, error: "Bitte etwas eingeben." };
  const rl = rateLimit(`capture:${session.user.id}`, LIMITS.aiCapture.limit, LIMITS.aiCapture.windowMs);
  if (!rl.ok) return { ok: false, error: "Zu viele Anfragen. Versuch es in einer Weile noch einmal." };
  try {
    const result = await quickCapture(text.trim());
    return { ok: true, result };
  } catch {
    return { ok: false, error: "Konnte die Eingabe nicht verarbeiten." };
  }
}

export async function acceptSuggestionAction(
  suggestion: CaptureEvent,
): Promise<{ ok: boolean; created: boolean; reason?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, created: false };

  // KI-Vorschläge sind nie Auto-Schreibvorgänge: erst auf Nutzeraktion anlegen.
  await logAiFeedback({
    suggestionId: suggestion.start + ":" + suggestion.title,
    suggestionPayload: suggestion,
    userId: session.user.id,
    action: "accepted",
  });

  try {
    const res = await createEvent(session.user.id, {
      title: suggestion.title,
      start: new Date(suggestion.start),
      end: new Date(suggestion.end),
      allDay: suggestion.allDay,
      category: suggestion.category,
      checklist: suggestion.checklist,
      careNeeded: suggestion.careNeeded,
      description: suggestion.notes,
      createdBy: displayNameForEmail(session.user.email),
    });
    revalidatePath("/woche");
    return { ok: true, created: res.created, reason: res.reason };
  } catch {
    return { ok: true, created: false, reason: "Anlegen in iCloud fehlgeschlagen." };
  }
}

export async function rejectSuggestionAction(suggestion: CaptureEvent) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await logAiFeedback({
    suggestionId: suggestion.start + ":" + suggestion.title,
    suggestionPayload: suggestion,
    userId: session.user.id,
    action: "rejected",
  });
  return { ok: true };
}
