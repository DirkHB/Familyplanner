import { Mark } from "@/components/ui/Mark";

export default function GesendetPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <Mark size={52} />
      <h1 className="mt-6 font-display text-4xl">Schau in dein Postfach 📬</h1>
      <p className="mt-2 text-ink-muted">
        Wir haben dir einen Login-Link geschickt. Tipp drauf, dann bist du drin — der Link gilt
        24&nbsp;Stunden.
      </p>
    </main>
  );
}
