"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ladeHaushaltEinAction,
  ziehEinladungZurueckAction,
  loescheHaushaltAction,
} from "./actions";

type OffeneEinladung = { id: string; email: string; bis: string; abgelaufen: boolean };
type Haushalt = {
  id: string;
  seit: string;
  menschen: string[];
  termine: number;
  aufgaben: number;
  /** Was zum Löschen abgetippt werden muss — die Adresse des Ersten. */
  abtippen: string;
  eigener: boolean;
};

export function EinladungenClient({
  offen,
  haushalte,
}: {
  offen: OffeneEinladung[];
  haushalte: Haushalt[];
}) {
  const [email, setEmail] = useState("");
  const [gesagt, setGesagt] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-md px-5 pb-16 pt-6">
        <header className="mb-2 flex items-center gap-3">
          <Link
            href="/woche"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-card"
            aria-label="Zurück"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <h1 className="font-display text-3xl">Einladungen</h1>
        </header>
        <p className="mb-6 text-ink-muted">
          Wer den Link annimmt, bekommt einen eigenen Bereich — eigener Kalender, eigene Namen,
          eigene Listen. Danach richtet sich die Familie selbst ein.
        </p>

        <section className="mb-8 rounded-card bg-surface p-5 shadow-card">
          <h2 className="font-display text-xl">Neue Familie einladen</h2>
          <div className="mt-4 flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              inputMode="email"
              placeholder="freund@example.com"
              className="w-full rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent"
            />
            <motion.button
              type="button"
              disabled={pending || !email.trim()}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
              onClick={() =>
                start(async () => {
                  const r = await ladeHaushaltEinAction(email);
                  setGesagt(r.ok ? "Einladung ist raus ✓" : (r.grund ?? "Hat nicht geklappt."));
                  if (r.ok) setEmail("");
                })
              }
              className="rounded-pill bg-accent px-5 py-3 font-medium text-surface disabled:opacity-60"
            >
              {pending ? "Schicke …" : "Einladung schicken"}
            </motion.button>
            {gesagt && <p className="text-sm text-ink-muted">{gesagt}</p>}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 font-display text-xl">Unterwegs</h2>
          {offen.length === 0 ? (
            <p className="text-ink-muted">Gerade keine offene Einladung.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {offen.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 shadow-card"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{e.email}</span>
                    <span className="text-sm text-ink-muted">
                      {e.abgelaufen ? `abgelaufen am ${e.bis}` : `gültig bis ${e.bis}`}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => start(() => ziehEinladungZurueckAction(e.id).then(() => {}))}
                    className="shrink-0 text-sm text-ink-muted underline disabled:opacity-60"
                  >
                    zurücknehmen
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl">Haushalte</h2>
          <ul className="flex flex-col gap-2">
            {haushalte.map((h) => (
              <HaushaltZeile key={h.id} h={h} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/**
 * Ein Haushalt in der Liste — und darunter, aufgeklappt, der einzige
 * unwiderrufliche Knopf dieser App.
 *
 * Er liegt bewusst nicht offen: Wer die Liste nur anschaut, soll ihn nicht
 * sehen. Und die Bestätigung wird abgetippt, nicht angeklickt — ein
 * „Wirklich?"-Fenster klickt man weg, ohne es gelesen zu haben.
 */
function HaushaltZeile({ h }: { h: Haushalt }) {
  const [offen, setOffen] = useState(false);
  const [eingabe, setEingabe] = useState("");
  const [gesagt, setGesagt] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <li className="rounded-card bg-surface px-4 py-3 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate">
            {h.menschen.length > 0 ? h.menschen.join(" und ") : "Noch niemand angemeldet"}
            {h.eigener && <span className="text-ink-muted"> · ihr</span>}
          </span>
          <span className="text-sm text-ink-muted">
            seit {h.seit} · {h.termine} {h.termine === 1 ? "Termin" : "Termine"} ·{" "}
            {h.aufgaben} {h.aufgaben === 1 ? "Aufgabe" : "Aufgaben"}
          </span>
        </span>
        {!h.eigener && (
          <button
            type="button"
            onClick={() => {
              setOffen((o) => !o);
              setGesagt(null);
            }}
            aria-expanded={offen}
            className="shrink-0 text-sm text-ink-muted underline"
          >
            {offen ? "abbrechen" : "löschen"}
          </button>
        )}
      </div>

      {offen && (
        <div className="mt-3 flex flex-col gap-2 border-t border-surface-muted pt-3">
          <p className="text-sm text-ink-muted">
            Löscht alles: Termine, Aufgaben, Einkauf, Betreuungen, Zugänge. Das lässt sich nicht
            rückgängig machen. Tipp zur Bestätigung{" "}
            <span className="font-medium text-ink">{h.abtippen}</span> ab.
          </p>
          <input
            value={eingabe}
            onChange={(e) => setEingabe(e.target.value)}
            autoComplete="off"
            placeholder={h.abtippen}
            className="w-full rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-signal"
          />
          <button
            type="button"
            disabled={pending || eingabe.trim().toLowerCase() !== h.abtippen.toLowerCase()}
            onClick={() =>
              start(async () => {
                const r = await loescheHaushaltAction(h.id, eingabe);
                if (!r.ok) setGesagt(r.grund ?? "Hat nicht geklappt.");
              })
            }
            className="rounded-pill bg-signal px-5 py-3 font-medium text-surface disabled:opacity-40"
          >
            {pending ? "Lösche …" : "Endgültig löschen"}
          </button>
          {gesagt && <p className="text-sm text-signal">{gesagt}</p>}
        </div>
      )}
    </li>
  );
}
