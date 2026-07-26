import Link from "next/link";
import { InstallHint } from "@/components/pwa/InstallHint";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <InstallHint />
      <p className="eyebrow text-ink-muted">Familienplaner</p>
      <h1 className="mt-2 font-display text-5xl leading-tight">
        Unser Plan.
        <br />
        Für Constanze &amp; Dirk.
      </h1>
      <p className="mt-4 text-ink-muted">
        Ein Blick voraus: Wochenansicht und Termin-Detail als Vorschau mit Beispieldaten.
        Der echte Kalender kommt, sobald wir ihn verbinden.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <Link
          href="/vorschau/woche"
          className="inline-flex w-fit rounded-pill bg-accent px-6 py-3.5 font-medium text-surface transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          Wochenansicht ansehen
        </Link>
        <div className="flex gap-3">
          <Link
            href="/vorschau/termin"
            className="inline-flex w-fit rounded-pill bg-ink px-5 py-3 font-medium text-surface transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            Termin-Detail
          </Link>
          <Link
            href="/style"
            className="inline-flex w-fit rounded-pill border border-ink/15 px-5 py-3 font-medium text-ink transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            Design-System
          </Link>
        </div>
      </div>
    </main>
  );
}
