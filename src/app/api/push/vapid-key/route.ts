export const dynamic = "force-dynamic";

/**
 * Liefert den öffentlichen VAPID-Key zur Laufzeit (er ist per Definition öffentlich).
 * Bewusst kein NEXT_PUBLIC_*: Das würde beim Build eingebacken — Sliplane baut das Image
 * aber vor den Runtime-Variablen. So funktioniert Push unabhängig vom Build.
 */
export async function GET() {
  return Response.json({ key: process.env.VAPID_PUBLIC_KEY ?? null });
}
