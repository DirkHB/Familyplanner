import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

/** Web Push (VAPID). Nur aktiv, wenn die Keys gesetzt sind. */

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:plan@planyourweek.app";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/** Sendet an alle Geräte eines Nutzers. Abgelaufene Subscriptions werden entfernt. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  for (const sub of subs) {
    const keys = sub.keys as { p256dh: string; auth: string };
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys },
        JSON.stringify(payload),
      );
      sent++;
    } catch (err: unknown) {
      const code = (err as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        // Gerät hat die Subscription verworfen → aufräumen.
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }
  }
  return sent;
}
