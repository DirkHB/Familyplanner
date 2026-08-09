import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { InstallHint } from "@/components/pwa/InstallHint";
import { haushaltProfil, beideNamen } from "@/lib/haushalt/profil";

export const dynamic = "force-dynamic";

/** Eingang: eingeloggt → direkt in die Woche, sonst klarer Weg zur Anmeldung. */
export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/woche");

  // Wer hier wohnt, steht in der Datenbank. Ist sie gerade nicht erreichbar,
  // bleibt die Seite trotzdem stehen — sie ist der Weg zur Anmeldung.
  const beide = await haushaltProfil()
    .then((p) => (p.erwachsene.every((e) => e.name) ? beideNamen(p) : ""))
    .catch(() => "");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <InstallHint />
      <p className="eyebrow text-ink-muted">Familienplaner</p>
      <h1 className="mt-2 font-display text-5xl leading-tight">
        Unser Plan.
        <br />
        {beide ? `Für ${beide}.` : "Für euch zwei."}
      </h1>
      <p className="mt-4 text-ink-muted">
        Kalender, Baby-Betreuung, Einkauf und Ideen — an einem Ort, für euch zwei.
      </p>
      <div className="mt-8">
        <Link
          href="/anmelden"
          className="inline-flex w-fit rounded-pill bg-accent px-8 py-4 font-medium text-surface transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          Anmelden
        </Link>
      </div>
      <p className="mt-6 text-sm text-ink-muted/70">
        {beide ? `Nur für ${beide}` : "Nur für Eingeladene"} — Anmeldung per
        E-Mail-Link, ohne Passwort.
      </p>
    </main>
  );
}
