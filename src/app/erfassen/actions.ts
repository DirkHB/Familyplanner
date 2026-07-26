"use server";

import { auth } from "@/auth";
import { aiConfigured } from "@/lib/ai/client";
import { quickCapture } from "@/lib/ai/quick-capture";
import { logAiFeedback } from "@/lib/ai/feedback";
import type { CaptureEvent, CaptureResult } from "@/lib/ai/schemas";

export async function captureAction(
  text: string,
): Promise<{ ok: true; result: CaptureResult } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Nicht angemeldet." };
  if (!aiConfigured()) return { ok: false, error: "KI ist noch nicht konfiguriert (API-Key fehlt)." };
  if (!text.trim()) return { ok: false, error: "Bitte etwas eingeben." };
  try {
    const result = await quickCapture(text.trim());
    return { ok: true, result };
  } catch {
    return { ok: false, error: "Konnte die Eingabe nicht verarbeiten." };
  }
}

export async function acceptSuggestionAction(suggestion: CaptureEvent) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  // KI-Vorschläge sind nie Auto-Schreibvorgänge: Feedback protokollieren.
  // Das tatsächliche Anlegen in iCloud folgt über den CalDAV-Schreibweg.
  await logAiFeedback({
    suggestionId: suggestion.start + ":" + suggestion.title,
    suggestionPayload: suggestion,
    userId: session.user.id,
    action: "accepted",
  });
  return { ok: true };
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
