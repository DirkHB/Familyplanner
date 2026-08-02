import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { countTodosDueToday } from "@/lib/klaerung/repository";
import { personForEmail } from "@/lib/auth/allowlist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Für die Tab-Leiste: rote Zahl am Aufgaben-Tab + eigene Person für den Profil-Kreis. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ aufgaben: 0 }, { status: 401 });
  const aufgaben = await countTodosDueToday().catch(() => 0);
  const { prisma } = await import("@/lib/prisma");
  const einkauf = await prisma.shoppingItem
    .count({ where: { checkedAt: null, list: { kind: "haupt" } } })
    .catch(() => 0);
  const person = session.user.email ? personForEmail(session.user.email) : null;
  return NextResponse.json({ aufgaben, einkauf, person });
}
