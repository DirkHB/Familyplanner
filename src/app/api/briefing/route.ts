import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generiereAssistentBriefing } from "@/lib/ai/assistent-briefing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Das Assistenten-Briefing für den Kopf der Woche. Wird vom Client NACH dem
 * Rendern geholt — die Seite wartet nie auf die KI. Dank Cache je Datenstand
 * antwortet es meistens sofort.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ text: null }, { status: 401 });
  const text = await generiereAssistentBriefing();
  return NextResponse.json({ text });
}
