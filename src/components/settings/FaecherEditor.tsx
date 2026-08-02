"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MAX_NAME_LAENGE } from "@/lib/names";

/**
 * Fächer anlegen, umbenennen, löschen.
 *
 * Aufgabenlisten und Läden sind dasselbe Ding mit anderer Beschriftung —
 * deshalb ein Bauteil für beide. Alles, was sich unterscheidet, kommt als
 * Text herein.
 */

export type Fach = { id: string; name: string; anzahl?: number };

export function FaecherEditor({
  ueberschrift,
  erklaerung,
  fachWort,
  restFach,
  faecher,
  onCreate,
  onRename,
  onDelete,
}: {
  ueberschrift: string;
  erklaerung: string;
  /** Wie ein einzelnes Fach heißt — „Liste" oder „Laden". */
  fachWort: string;
  /** Wohin Übriggebliebenes rutscht, wenn ein Fach gelöscht wird. */
  restFach: string;
  faecher: Fach[];
  onCreate: (name: string) => Promise<{ ok: boolean; grund?: string }>;
  onRename: (id: string, name: string) => Promise<{ ok: boolean; grund?: string }>;
  onDelete: (id: string) => Promise<{ ok: boolean }>;
}) {
  const [neu, setNeu] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function anlegen() {
    const name = neu.trim();
    if (!name) return;
    start(async () => {
      const r = await onCreate(name);
      if (r.ok) {
        setNeu("");
        setFehler(null);
      } else {
        setFehler(r.grund ?? "Hat nicht geklappt.");
      }
    });
  }

  return (
    <section className="mt-4 rounded-card bg-surface p-5 shadow-card">
      <h2 className="font-display text-lg">{ueberschrift}</h2>
      <p className="mt-1 text-sm text-ink-muted">{erklaerung}</p>

      <ul className="mt-4 flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {faecher.map((f) => (
            <motion.li
              key={f.id}
              layout
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
            >
              <FachZeile
                fach={f}
                fachWort={fachWort}
                restFach={restFach}
                onRename={onRename}
                onDelete={onDelete}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {faecher.length === 0 && (
        <p className="mt-3 text-sm text-ink-muted/80">Noch nichts angelegt.</p>
      )}

      <div className="mt-4 flex gap-2">
        <input
          value={neu}
          onChange={(e) => {
            setNeu(e.target.value);
            setFehler(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && anlegen()}
          maxLength={MAX_NAME_LAENGE}
          placeholder={`${fachWort} hinzufügen`}
          className="min-w-0 flex-1 rounded-pill bg-bg px-4 py-2.5 text-[15px] outline-none placeholder:text-ink-muted/60"
        />
        <button
          onClick={anlegen}
          disabled={pending || !neu.trim()}
          className="shrink-0 rounded-pill bg-accent px-4 py-2.5 text-sm font-medium text-surface disabled:opacity-50"
        >
          Hinzufügen
        </button>
      </div>
      {fehler && <p className="mt-2 text-sm text-signal">{fehler}</p>}
    </section>
  );
}

function FachZeile({
  fach,
  fachWort,
  restFach,
  onRename,
  onDelete,
}: {
  fach: Fach;
  fachWort: string;
  restFach: string;
  onRename: (id: string, name: string) => Promise<{ ok: boolean; grund?: string }>;
  onDelete: (id: string) => Promise<{ ok: boolean }>;
}) {
  const [modus, setModus] = useState<"ruhe" | "umbenennen" | "loeschen">("ruhe");
  const [name, setName] = useState(fach.name);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (modus === "umbenennen") {
    return (
      <div className="rounded-card bg-bg p-3">
        <div className="flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setFehler(null);
            }}
            maxLength={MAX_NAME_LAENGE}
            className="min-w-0 flex-1 rounded-pill bg-surface px-3 py-2 text-[15px] outline-none"
          />
          <button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await onRename(fach.id, name);
                if (r.ok) setModus("ruhe");
                else setFehler(r.grund ?? "Hat nicht geklappt.");
              })
            }
            className="shrink-0 rounded-pill bg-accent px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
          >
            Speichern
          </button>
          <button
            onClick={() => {
              setName(fach.name);
              setFehler(null);
              setModus("ruhe");
            }}
            className="shrink-0 px-2 text-sm text-ink-muted"
          >
            Zurück
          </button>
        </div>
        {fehler && <p className="mt-2 text-sm text-signal">{fehler}</p>}
      </div>
    );
  }

  if (modus === "loeschen") {
    return (
      <div className="rounded-card bg-bg p-3">
        <p className="text-sm">
          „{fach.name}" löschen?
          {fach.anzahl ? (
            <>
              {" "}
              Die {fach.anzahl} {fach.anzahl === 1 ? "Sache darin rutscht" : "Sachen darin rutschen"}{" "}
              nach „{restFach}" — nichts geht verloren.
            </>
          ) : (
            <> Ist leer.</>
          )}
        </p>
        <div className="mt-2.5 flex gap-2">
          <button
            disabled={pending}
            onClick={() => start(() => onDelete(fach.id).then(() => {}))}
            className="rounded-pill bg-signal px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
          >
            Löschen
          </button>
          <button onClick={() => setModus("ruhe")} className="px-3 text-sm text-ink-muted">
            Behalten
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-card bg-bg px-3 py-2.5">
      <span className="min-w-0 flex-1 truncate font-medium">{fach.name}</span>
      {fach.anzahl ? (
        <span className="shrink-0 text-sm text-ink-muted">{fach.anzahl}</span>
      ) : null}
      <button
        onClick={() => setModus("umbenennen")}
        className="shrink-0 text-sm font-medium text-accent"
        aria-label={`${fach.name} umbenennen`}
      >
        Umbenennen
      </button>
      <button
        onClick={() => setModus("loeschen")}
        className="shrink-0 text-sm text-ink-muted/70"
        aria-label={`${fach.name} löschen`}
      >
        Löschen
      </button>
    </div>
  );
}
