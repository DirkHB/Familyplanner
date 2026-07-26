import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <p className="eyebrow text-ink-muted">Familienplaner</p>
      <h1 className="mt-2 font-display text-5xl leading-tight">
        Unser Plan.
        <br />
        Für Dirk &amp; Constanze.
      </h1>
      <p className="mt-4 text-ink-muted">
        Phase 0 steht: Fundament, Design-System und Deployment-Vorbereitung.
        Die Screens folgen in Phase 1.
      </p>
      <Link
        href="/style"
        className="mt-8 inline-flex w-fit rounded-pill bg-ink px-6 py-3.5 font-medium text-surface transition-transform duration-150 ease-out active:scale-[0.97]"
      >
        Design-System ansehen
      </Link>
    </main>
  );
}
