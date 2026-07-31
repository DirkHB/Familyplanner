import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { countTodosDueToday } from "@/lib/klaerung/repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Zahl für die rote Markierung am Aufgaben-Tab: heute fällig oder überfällig. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ aufgaben: 0 }, { status: 401 });
  const aufgaben = await countTodosDueToday().catch(() => 0);
  return NextResponse.json({ aufgaben });
}
