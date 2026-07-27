import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Speichert die Web-Push-Subscription des aktuellen Nutzers. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const rl = rateLimit(`push:${session.user.id}`, LIMITS.pushSubscribe.limit, LIMITS.pushSubscribe.windowMs);
  if (!rl.ok) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
    });
  }

  const sub = (await req.json().catch(() => null)) as
    | { endpoint?: string; keys?: { p256dh: string; auth: string } }
    | null;
  if (!sub?.endpoint || !sub.keys) {
    return new Response("Bad Request", { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId: session.user.id, endpoint: sub.endpoint, keys: sub.keys },
    update: { userId: session.user.id, keys: sub.keys },
  });

  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (endpoint) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: session.user.id },
    });
  }
  return Response.json({ ok: true });
}
