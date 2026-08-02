import Link from "next/link";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { personForEmail, displayNameForEmail } from "@/lib/auth/allowlist";
import { abmeldenAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Das eigene Profil — der Ort hinter dem Kreis ganz rechts in der Leiste.
 * Hier wohnen die Dinge, die zu einem selbst gehören, allen voran die
 * Einstellungen: von überall erreichbar, ohne der Woche ein Zahnrad zu geben.
 */
export default async function ProfilPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const person = personForEmail(email);
  const name = displayNameForEmail(email);

  return (
    <AppShell>
      <>
        <div className="flex items-center gap-4">
          <Avatar person={person} size={64} />
          <div className="min-w-0">
            <h1 className="font-display text-3xl leading-tight">{name}</h1>
            <p className="truncate text-sm text-ink-muted">{email}</p>
          </div>
        </div>

        <div className="mt-6 divide-y divide-surface-muted/60 rounded-card bg-surface shadow-card">
          <ProfilZeile href="/einstellungen" titel="Einstellungen" hinweis="Kalender, Listen, Mitteilungen" />
          <ProfilZeile href="/ideen" titel="Ideen & Urlaub" hinweis="Der Merkzettel für später" />
        </div>

        <form action={abmeldenAction} className="mt-6 text-center">
          <button className="px-4 py-2 text-sm text-ink-muted/80">Abmelden</button>
        </form>
      </>
    </AppShell>
  );
}

function ProfilZeile({ href, titel, hinweis }: { href: string; titel: string; hinweis: string }) {
  return (
    <Link href={href} className="flex min-h-12 items-center gap-3 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{titel}</span>
        <span className="block text-sm text-ink-muted">{hinweis}</span>
      </span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-ink-muted/70" aria-hidden>
        <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
