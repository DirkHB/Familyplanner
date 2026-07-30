import "server-only";
import { prisma } from "@/lib/prisma";
import { mergePrefs, isQuietHours } from "./quiet-hours";
import { sendPushToUser, type PushPayload } from "./webpush";

/** Push an eine User-ID — mit Präferenzen und Ruhezeiten (21–7) respektiert. */
export async function notifyUserId(userId: string, payload: PushPayload): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return 0;
  const prefs = mergePrefs(user.notificationPrefs);
  if (isQuietHours(new Date(), prefs.quietStart, prefs.quietEnd)) return 0;
  return sendPushToUser(userId, payload);
}
