import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Healthcheck fuer Sliplane. Bewusst ohne Datenbank, ohne Session, ohne
 * Kalender: Der Check soll sagen "der Prozess laeuft", nicht "alles ist gut".
 * Sonst reisst ein kurzer DB-Haenger den ganzen Service in eine Redeploy-
 * Schleife — genau das ist uns beim Postgres-Container passiert.
 */
export function GET() {
  return NextResponse.json({ ok: true, service: "app" });
}
