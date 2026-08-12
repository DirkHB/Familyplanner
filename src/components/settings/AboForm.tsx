"use client";

import { useActionState } from "react";
import { abonniereKalenderAction } from "@/app/einstellungen/actions";

/**
 * Einen fremden Kalender abonnieren.
 *
 * Gedacht für Google — dessen Kalender kann die App nicht selbst anbinden,
 * weil Google seit März 2025 nur noch OAuth zulässt und wir dafür ein
 * geprüftes Konto bei Google bräuchten. Ein Abonnement kommt ohne all das
 * aus: eine Adresse, unter der eine Datei liegt.
 *
 * Und es kann mehr als Google: Outlook, Nextcloud, der Vereinskalender, die
 * Kita — alles, was eine solche Adresse anbietet.
 *
 * Der Preis steht deshalb gleich dabei: Es geht nur in eine Richtung.
 */
export function AboForm() {
  const [state, action, pending] = useActionState(abonniereKalenderAction, {
    error: null as string | null,
  });

  if (state?.gefunden !== undefined && !state.error) {
    return (
      <p className="text-sm text-ink-muted">
        Abonniert ✓ {state.gefunden} {state.gefunden === 1 ? "Termin" : "Termine"} gefunden. Sie
        stehen ab jetzt in der Woche; der Abgleich läuft alle fünf Minuten.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">
        Für Kalender, die die App nicht selbst anbinden kann — vor allem Google. Bei Google
        findest du die Adresse unter <span className="text-ink">Einstellungen → Kalender →
        Kalender integrieren → Geheime Adresse im iCal-Format</span>.
      </p>
      <input
        name="url"
        inputMode="url"
        autoComplete="off"
        required
        placeholder="https://calendar.google.com/…/basic.ics"
        className="w-full rounded-card border border-surface-muted bg-bg px-4 py-3 text-base outline-none focus:border-accent"
      />
      <input
        name="name"
        autoComplete="off"
        placeholder="Wie soll er heißen? (z. B. Johanna)"
        className="w-full rounded-card border border-surface-muted bg-bg px-4 py-3 text-base outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-pill bg-ink px-5 py-3 font-medium text-surface disabled:opacity-60"
      >
        {pending ? "Hole den Kalender …" : "Abonnieren"}
      </button>
      {state?.error && <p className="text-sm text-signal">{state.error}</p>}
      <p className="text-sm text-ink-muted">
        <span className="font-medium text-ink">Nur lesend.</span> Die Termine sind zu sehen, aber
        die App kann nichts hineinschreiben — dafür ist ein Abonnement nicht gemacht. Wer hier
        etwas anlegt, tut das weiter im eigenen Kalender.
      </p>
      <p className="text-sm text-ink-muted">
        Die Adresse ist ein Geheimnis: Wer sie hat, sieht den Kalender. Sie wird verschlüsselt
        gespeichert und nirgends wieder angezeigt.
      </p>
    </form>
  );
}
