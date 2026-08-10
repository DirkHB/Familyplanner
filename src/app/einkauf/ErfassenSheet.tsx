"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { motion } from "motion/react";
import { OHNE_LADEN } from "@/lib/shopping/stores";
import { addManyAction } from "./actions";

/**
 * Der Einkauf wird nicht Zeile für Zeile eingetippt, sondern in einem Rutsch.
 *
 * Vorher stand unten ein Feld für genau einen Artikel. Wer nach dem Wochenplan
 * sieben Dinge braucht, hat siebenmal getippt und siebenmal gewartet — und die
 * Liste wuchs vor den Augen, aber der Kopf war schon zwei Artikel weiter.
 * Hier kommt alles auf einmal hinein, eine Zeile je Sache oder mit Kommas,
 * wie es gerade schneller geht.
 *
 * Ein Geschäft für alles. Das ist keine Einschränkung, sondern wie man
 * einkauft: Man schreibt auf, was beim Rewe fehlt, und danach, was in der
 * Drogerie fehlt. Verschieben geht später durch Ziehen.
 *
 * Zwei Knöpfe, weil es zwei Absichten gibt: weitermachen (das Feld leert sich,
 * das Geschäft bleibt stehen) oder fertig sein. Das × oben rechts wirft weg,
 * was noch nicht gespeichert ist.
 */

export type Geschaeft = { key: string; label: string };

export function ErfassenSheet({
  geschaefte,
  onZu,
  onGespeichert,
}: {
  geschaefte: Geschaeft[];
  onZu: () => void;
  onGespeichert: () => void;
}) {
  const [text, setText] = useState("");
  const [ziel, setZiel] = useState(geschaefte[0]?.key ?? OHNE_LADEN);
  const [gesagt, setGesagt] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const feld = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    feld.current?.focus();
  }, []);

  // Escape schließt — am Schreibtisch die schnellste Geste, und auf dem
  // Telefon kostet es nichts.
  useEffect(() => {
    const auf = (e: KeyboardEvent) => {
      if (e.key === "Escape") onZu();
    };
    window.addEventListener("keydown", auf);
    return () => window.removeEventListener("keydown", auf);
  }, [onZu]);

  function speichern(danachSchliessen: boolean) {
    const inhalt = text.trim();
    if (!inhalt) {
      setGesagt("Da steht noch nichts.");
      return;
    }
    start(async () => {
      const r = await addManyAction(inhalt, ziel);
      if (!r.ok) {
        setGesagt(r.grund ?? "Hat nicht geklappt.");
        return;
      }
      onGespeichert();
      if (danachSchliessen) {
        onZu();
        return;
      }
      // Weitermachen: Das Feld ist leer, das Geschäft bleibt. Und es steht da,
      // was angekommen ist — sonst weiß man nicht, ob aus „Milch 1,5%, Brot"
      // zwei Zeilen wurden oder drei.
      setText("");
      setGesagt(
        r.artikel.length === 1
          ? `„${r.artikel[0]}" ist drauf ✓`
          : `${r.artikel.length} Sachen sind drauf ✓ — ${r.artikel.join(", ")}`,
      );
      feld.current?.focus();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Der Hintergrund ist selbst der Weg hinaus — antippen schließt. */}
      <button
        type="button"
        aria-label="Schließen"
        onClick={onZu}
        className="absolute inset-0 bg-ink/40"
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        role="dialog"
        aria-modal="true"
        aria-label="Sachen auf die Liste setzen"
        // dvh statt vh: Auf dem Telefon schiebt sich die Tastatur über das
        // Blatt, und nur die dynamische Höhe schrumpft mit. Sonst lägen die
        // beiden Knöpfe darunter — sichtbar wäre nur das, was man schon
        // getippt hat.
        className="relative z-10 flex max-h-[88dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-card bg-surface p-5 shadow-hero sm:rounded-card"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Was fehlt?</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Eine Sache pro Zeile — oder mit Kommas. Wir sortieren das.
            </p>
          </div>
          <button
            type="button"
            onClick={onZu}
            aria-label="Schließen, ohne zu speichern"
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <textarea
          ref={feld}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setGesagt(null);
          }}
          rows={6}
          placeholder={"Tomaten\nKäse\nBrot"}
          className="w-full resize-none rounded-card border border-surface-muted bg-bg px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-accent"
        />

        <div>
          <p className="mb-2 text-sm text-ink-muted">In welches Geschäft?</p>
          <div className="flex flex-wrap gap-2">
            {geschaefte.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setZiel(g.key)}
                aria-pressed={ziel === g.key}
                className={`rounded-pill px-4 py-2 text-sm font-medium transition-colors ${
                  ziel === g.key ? "bg-ink text-surface" : "bg-surface-muted text-ink"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {gesagt && <p className="text-sm text-ink-muted">{gesagt}</p>}

        {/* Untereinander, solange der Platz schmal ist: Nebeneinander brechen
            beide Beschriftungen auf zwei Zeilen um, und zwei zweizeilige
            Knöpfe sehen aus wie ein Fehler. */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={pending}
            onClick={() => speichern(false)}
            className="flex-1 rounded-pill bg-surface-muted px-4 py-3 font-medium text-ink disabled:opacity-60"
          >
            {pending ? "…" : "Speichern und weiter"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => speichern(true)}
            className="flex-1 rounded-pill bg-accent px-4 py-3 font-medium text-surface disabled:opacity-60"
          >
            {pending ? "…" : "Speichern und schließen"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
