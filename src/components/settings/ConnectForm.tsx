"use client";

import { useActionState } from "react";
import { connectAction } from "@/app/einstellungen/actions";

/**
 * iCloud verbinden. Steht an zwei Stellen — in den Einstellungen und im
 * Einrichtungs-Assistenten —, deshalb wohnt das Formular hier statt zweimal.
 */
export function ConnectForm() {
  const [state, formAction, pending] = useActionState(connectAction, { error: null });
  return (
    <div>
      <p className="text-sm text-ink-muted">
        Mit deiner Apple-ID und einem <b className="text-ink">app-spezifischen Passwort</b>{" "}
        (erzeugen unter appleid.apple.com → „App-spezifische Passwörter"). Es wird
        verschlüsselt gespeichert.
      </p>
      <form action={formAction} className="mt-3 flex flex-col gap-2.5">
        <input
          name="username"
          type="email"
          required
          placeholder="deine@apple-id.de"
          autoComplete="off"
          className="rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="xxxx-xxxx-xxxx-xxxx"
          autoComplete="off"
          className="rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill bg-accent px-5 py-3 font-medium text-surface disabled:opacity-60"
        >
          {pending ? "Verbinde …" : "Verbinden"}
        </button>
        {state?.error && <p className="text-sm text-signal">{state.error}</p>}
      </form>
    </div>
  );
}
