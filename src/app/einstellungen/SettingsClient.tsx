"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  connectAction,
  toggleCalendarAction,
  syncNowAction,
  disconnectAction,
} from "./actions";

type Cal = {
  id: string;
  name: string;
  isSynced: boolean;
  lastSyncedLabel: string | null;
  lastSyncOk: boolean;
  lastError: string | null;
};
type Account = { id: string; username: string; calendars: Cal[] } | null;

export function SettingsClient({ account }: { account: Account }) {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-md px-5 pb-16 pt-6">
        <header className="mb-6 flex items-center gap-3">
          <Link
            href="/woche"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-card"
            aria-label="Zurück"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="font-display text-3xl">Einstellungen</h1>
        </header>

        {account ? <Connected account={account} /> : <ConnectForm />}
      </div>
    </div>
  );
}

function ConnectForm() {
  const [state, formAction, pending] = useActionState(connectAction, { error: null });
  return (
    <section className="rounded-card bg-surface p-5 shadow-card">
      <h2 className="font-display text-xl">iCloud-Kalender verbinden</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Mit deiner Apple-ID und einem <b>app-spezifischen Passwort</b>. Erzeuge es unter{" "}
        <span className="text-ink">appleid.apple.com</span> → „App-spezifische Passwörter". Dein
        Passwort wird verschlüsselt gespeichert.
      </p>
      <form action={formAction} className="mt-4 flex flex-col gap-3">
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
          className="rounded-pill bg-accent px-5 py-3.5 font-medium text-surface disabled:opacity-60"
        >
          {pending ? "Verbinde …" : "Verbinden"}
        </button>
        {state?.error && <p className="text-sm text-signal">{state.error}</p>}
      </form>
    </section>
  );
}

function Connected({ account }: { account: NonNullable<Account> }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function syncNow() {
    start(async () => {
      const r = await syncNowAction();
      setResult(
        r.ok
          ? `Fertig · ${r.upserted} aktualisiert, ${r.deleted} entfernt${
              r.errorCount ? `, ${r.errorCount} Fehler` : ""
            }`
          : "Sync fehlgeschlagen",
      );
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-card bg-surface p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow text-ink-muted">Verbunden</p>
            <p className="font-display text-lg">{account.username}</p>
          </div>
          <button
            onClick={() => start(() => disconnectAction(account.id))}
            className="text-sm text-signal"
          >
            Trennen
          </button>
        </div>
      </section>

      <section className="rounded-card bg-surface p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Sync</h2>
          <button
            onClick={syncNow}
            disabled={pending}
            className="rounded-pill bg-accent px-4 py-2 text-sm font-medium text-surface disabled:opacity-60"
          >
            {pending ? "läuft …" : "Jetzt synchronisieren"}
          </button>
        </div>
        {result && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-sm text-ink-muted">
            {result}
          </motion.p>
        )}
      </section>

      <section className="rounded-card bg-surface p-5 shadow-card">
        <h2 className="mb-3 font-display text-lg">Kalender</h2>
        <ul className="flex flex-col divide-y divide-surface-muted/60">
          {account.calendars.map((cal) => (
            <CalRow key={cal.id} cal={cal} disabled={pending} onToggle={(v) => start(() => toggleCalendarAction(cal.id, v))} />
          ))}
          {account.calendars.length === 0 && (
            <li className="py-3 text-sm text-ink-muted">Keine Kalender gefunden.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function CalRow({
  cal,
  disabled,
  onToggle,
}: {
  cal: Cal;
  disabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <li className="flex items-center justify-between py-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{cal.name}</p>
        <p className="text-xs text-ink-muted">
          {cal.lastError ? (
            <span className="text-signal">Fehler: {cal.lastError}</span>
          ) : cal.lastSyncedLabel ? (
            `zuletzt ${cal.lastSyncedLabel}`
          ) : (
            "noch nicht synchronisiert"
          )}
        </p>
      </div>
      <button
        role="switch"
        aria-checked={cal.isSynced}
        disabled={disabled}
        onClick={() => onToggle(!cal.isSynced)}
        className={`relative h-7 w-12 shrink-0 rounded-pill transition-colors ${
          cal.isSynced ? "bg-accent" : "bg-surface-muted"
        }`}
      >
        <span
          className="absolute top-0.5 h-6 w-6 rounded-full bg-surface transition-all"
          style={{ left: cal.isSynced ? 22 : 2 }}
        />
      </button>
    </li>
  );
}
