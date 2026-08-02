"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { EnableNotifications } from "@/components/push/EnableNotifications";
import {
  connectAction,
  toggleCalendarAction,
  syncNowAction,
  disconnectAction,
  sendTestPushAction,
  setCareBlocksAction,
  createTodoListAction,
  renameTodoListAction,
  deleteTodoListAction,
  createStoreAction,
  renameStoreAction,
  deleteStoreAction,
} from "./actions";
import { FaecherEditor, type Fach } from "@/components/settings/FaecherEditor";
import { RemindersImport } from "@/components/settings/RemindersImport";

type Cal = {
  id: string;
  name: string;
  isSynced: boolean;
  lastSyncedLabel: string | null;
  lastSyncOk: boolean;
  lastError: string | null;
};
type Account = { id: string; username: string; calendars: Cal[] } | null;

export type Diagnose = {
  name: string;
  isSynced: boolean;
  termine: number;
  mitOrganizer: number;
  mitAttendee: number;
  ersteller: { mail: string; anzahl: number }[];
  titelMitName: number;
};

export function SettingsClient({
  account,
  diagnose = [],
  abgewinkt = [],
  careBlocks = false,
  todoLists = [],
  stores = [],
}: {
  account: Account;
  diagnose?: Diagnose[];
  abgewinkt?: string[];
  careBlocks?: boolean;
  todoLists?: Fach[];
  stores?: Fach[];
}) {
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

        <section className="mt-4 rounded-card bg-surface p-5 shadow-card">
          <h2 className="font-display text-lg">Benachrichtigungen</h2>
          <p className="mt-1 mb-3 text-sm text-ink-muted">
            Für Anfragen und Erinnerungen. Nachts ist Ruhe (21–7 Uhr).
          </p>
          <EnableNotifications />
          <TestPush />
        </section>

        <CareBlocksSetting an={careBlocks} />

        <FaecherEditor
          ueberschrift="Aufgabenlisten"
          erklaerung={
            "Fächer für eure Aufgaben — Haushalt, Nicolas, Papierkram. Eine Aufgabe braucht keine Liste: Der schnelle Eintrag zwischendurch soll nicht erst eine Einordnung verlangen."
          }
          fachWort="Liste"
          restFach="Ohne Liste"
          faecher={todoLists}
          onCreate={createTodoListAction}
          onRename={renameTodoListAction}
          onDelete={deleteTodoListAction}
        />

        <RemindersImport />

        <FaecherEditor
          ueberschrift="Läden"
          erklaerung={
            "Nach diesen Fächern ist die Einkaufsliste sortiert. Sonstiges ist immer da und fängt alles auf, was keinem Laden zugeordnet ist."
          }
          fachWort="Laden"
          restFach="Sonstiges"
          faecher={stores}
          onCreate={createStoreAction}
          onRename={renameStoreAction}
          onDelete={deleteStoreAction}
        />

        {diagnose.length > 0 && <DiagnoseBlock diagnose={diagnose} />}
        {abgewinkt.length > 0 && <AbgewinktBlock titel={abgewinkt} />}
      </div>
    </div>
  );
}

/**
 * Was steht in unseren Terminen? Grundlage für die Frage, ob wir „wer ist
 * gebunden?" von Hand pflegen müssen — oder ob iCloud es uns schon verrät.
 */
function DiagnoseBlock({ diagnose }: { diagnose: Diagnose[] }) {
  const [offen, setOffen] = useState(false);
  const gesamt = diagnose.reduce((n, d) => n + d.termine, 0);
  const mitErsteller = diagnose.reduce((n, d) => n + d.mitOrganizer, 0);
  const mitName = diagnose.reduce((n, d) => n + d.titelMitName, 0);

  return (
    <section className="mt-4 rounded-card bg-surface p-5 shadow-card">
      <button onClick={() => setOffen((o) => !o)} className="flex w-full items-center justify-between text-left">
        <h2 className="font-display text-lg">Was steht in euren Terminen?</h2>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          style={{ transform: offen ? "rotate(90deg)" : "none", transition: "transform 160ms" }}>
          <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <p className="mt-1 text-sm text-ink-muted">
        {gesamt} Termine · bei {mitErsteller} steht, wer sie angelegt hat · {mitName} tragen einen Namen im Titel
      </p>

      {offen && (
        <div className="mt-4 flex flex-col gap-3">
          {diagnose.map((d) => (
            <div key={d.name} className="rounded-card bg-bg p-3">
              <p className="font-medium">
                {d.name}
                {!d.isSynced && <span className="ml-2 text-xs text-ink-muted">(aus)</span>}
              </p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {d.termine} Termine · {d.mitOrganizer} mit Ersteller · {d.mitAttendee} mit Teilnehmern ·{" "}
                {d.titelMitName} mit Namen im Titel
              </p>
              {d.ersteller.length > 0 && (
                <ul className="mt-1.5 flex flex-col gap-0.5">
                  {d.ersteller.map((e) => (
                    <li key={e.mail} className="truncate text-xs text-ink-muted">
                      {e.mail} — {e.anzahl}×
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <p className="text-xs text-ink-muted/80">
            Steht bei vielen Terminen ein Ersteller, kann die App von allein erkennen, wen ein Termin
            bindet. Sonst fragt sie einmal je Termin-Art nach.
          </p>
        </div>
      )}
    </section>
  );
}

/** Termine, für die „nie eine Betreuung nötig" gilt — zum Nachsehen. */
function AbgewinktBlock({ titel }: { titel: string[] }) {
  return (
    <section className="mt-4 rounded-card bg-surface p-5 shadow-card">
      <h2 className="font-display text-lg">Ohne Betreuungsfrage</h2>
      <p className="mt-1 mb-2 text-sm text-ink-muted">
        Bei diesen Terminen fragt die App nicht mehr, wer bei Nicolas ist.
      </p>
      <p className="text-sm text-ink">{titel.join(" · ")}</p>
    </section>
  );
}

/**
 * Betreuung als echter Kalendereintrag. Bewusst mit Schalter und
 * standardmäßig aus: Es ist die einzige Funktion, die von sich aus Einträge im
 * gemeinsamen Kalender anlegt.
 */
function CareBlocksSetting({ an }: { an: boolean }) {
  const [pending, start] = useTransition();
  const [aktiv, setAktiv] = useState(an);
  return (
    <section className="mt-4 rounded-card bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg">Betreuung im Kalender</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Wer die Betreuung übernimmt, bekommt einen Eintrag „👶 Nicolas · Name" im
            gemeinsamen Kalender — sichtbar auf dem Sperrbildschirm, ohne die App zu öffnen.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={aktiv}
          aria-label="Betreuung im Kalender eintragen"
          disabled={pending}
          onClick={() => {
            const neu = !aktiv;
            setAktiv(neu);
            start(async () => { await setCareBlocksAction(neu); });
          }}
          className={`relative mt-1 h-7 w-12 shrink-0 rounded-pill transition-colors ${
            aktiv ? "bg-accent" : "bg-surface-muted"
          }`}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            className="absolute top-0.5 h-6 w-6 rounded-full bg-surface shadow-card"
            style={{ left: aktiv ? 22 : 2 }}
          />
        </button>
      </div>
      {aktiv && (
        <p className="mt-3 text-xs text-ink-muted/80">
          Nimmst du eine Zusage zurück, verschwindet der Eintrag wieder.
        </p>
      )}
    </section>
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

function TestPush() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  return (
    <div className="mt-3 border-t border-surface-muted/60 pt-3">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await sendTestPushAction();
            if (r.devices === 0) {
              setResult(
                "Kein Gerät registriert. Erst oben Benachrichtigungen aktivieren — auf dem iPhone geht das nur in der installierten App (Teilen → Zum Home-Bildschirm).",
              );
            } else {
              setResult(
                `An ${r.sent} von ${r.devices} Gerät${r.devices === 1 ? "" : "en"} gesendet — kam sie an?` +
                  (r.quiet ? " (Hinweis: Gerade sind Ruhezeiten — normale Pushes pausieren 21–7 Uhr, dieser Test nicht.)" : ""),
              );
            }
          })
        }
        className="text-sm font-medium text-accent"
      >
        {pending ? "Sende …" : "Test-Benachrichtigung an mich senden"}
      </button>
      {result && <p className="mt-2 text-sm text-ink-muted">{result}</p>}
    </div>
  );
}
