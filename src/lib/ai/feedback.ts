import "server-only";
import { prisma } from "@/lib/prisma";

/** Jede KI-Aktion (Übernehmen/Anpassen/Verwerfen) landet in ai_feedback (Abschnitt 6.5). */
export async function logAiFeedback(input: {
  suggestionId: string;
  suggestionPayload: unknown;
  userId?: string | null;
  action: "accepted" | "rejected" | "edited";
  editedResult?: unknown;
}) {
  await prisma.aiFeedback.create({
    data: {
      suggestionId: input.suggestionId,
      suggestionPayload: input.suggestionPayload as object,
      userId: input.userId ?? null,
      action: input.action,
      editedResult: (input.editedResult ?? undefined) as object | undefined,
    },
  });
}
