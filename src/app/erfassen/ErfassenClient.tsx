"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { captureAction, acceptSuggestionAction, rejectSuggestionAction } from "./actions";
import type { SmartItem } from "@/lib/ai/smart-capture";

const timeFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  timeZone: "Europe/Berlin",
});
const dateFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Berlin",
});

const KIND_META: Record<string, { label: string; icon: string; tone: string }> = {
  termin: { label: "Termin", icon: "📅", tone: "var(--color-accent)" },
  aufgabe: { label: "Aufgabe", icon: "✓", tone: "var(--color-ink)" },
  einkauf: { label: "Einkauf", icon: "🛒", tone: "var(--color-counter)" },
};

const EXAMPLES = [
  "Donnerstag 15 Uhr Kinderarzt U3",
  "Windeln und Haferdrink kaufen",
  "Constanze soll die Kita anrufen",
];

export function ErfassenClient({ configured }: { configured: boolean }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [items, setItems] = useState<SmartItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function analyze(value?: string) {
    const input = (value ?? text).trim();
    if (!input) return;
    setText(input);
    setError(null);
    start(async () => {
      const res = await captureAction(input);
      if (res.ok) setItems(res.result.items);
      else setError(res.error);
    });
  }

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-md px-5 pb-28 pt-6">
        <header className="mb-5 flex items-center gap-3">
          <Link href="/woche" className="flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-card" aria-label="Zurück">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="font-display text-3xl">Erfassen</h1>
        </header>

        <p className="mb-3 text-ink-muted">
          Sprich oder schreib einfach los — Termin, Aufgabe oder Einkauf. Ich sortiere es ein.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Was steht an?"
          className="w-full resize-none rounded-card border border-surface-muted bg-surface p-4 outline-none focus:border-accent"
        />

        {/* Diktieren geht über die Systemtastatur. Die Web-Spracherkennung
            funktioniert in installierten iOS-PWAs nicht — die Taste auf der
            Tastatur schon, und sie ist ohnehin die bessere: auf dem Gerät,
            sofort, und sie kennt eure Namen. */}
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted/80">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
          </svg>
          Tipp: Antippen und über das Mikrofon der Tastatur diktieren — geht schneller als tippen.
        </p>

        {!items && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => analyze(ex)}
                className="rounded-pill bg-surface px-3 py-1.5 text-xs text-ink-muted shadow-card"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => analyze()}
          disabled={pending || !configured}
          className="mt-3 w-full rounded-pill bg-accent px-5 py-3.5 font-medium text-surface disabled:opacity-60"
        >
          {pending ? "Denke nach …" : "Vorschlag erstellen"}
        </button>
        {!configured && <p className="mt-2 text-sm text-ink-muted">KI ist noch nicht konfiguriert (API-Key fehlt).</p>}
        {error && <p className="mt-2 text-sm text-signal">{error}</p>}

        <AnimatePresence>
          {items && items.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex flex-col gap-3">
              <p className="eyebrow text-ink-muted">Vorschau · übernehmen oder verwerfen</p>
              {items.map((it, i) => (
                <SuggestionCard key={i} item={it} />
              ))}
            </motion.div>
          )}
          {items && items.length === 0 && (
            <p className="mt-6 text-ink-muted">Daraus konnte ich nichts ableiten.</p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SuggestionCard({ item }: { item: SmartItem }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<"open" | "accepted" | "rejected">("open");
  const [note, setNote] = useState("");
  if (state === "rejected") return null;

  const meta = KIND_META[item.kind] ?? KIND_META.aufgabe;
  const when =
    item.kind === "termin" && item.start
      ? item.allDay
        ? `${dateFmt.format(new Date(item.start))} · ganztägig`
        : timeFmt.format(new Date(item.start))
      : item.kind === "aufgabe" && item.dueDate
        ? `bis ${dateFmt.format(new Date(`${item.dueDate}T12:00:00`))}`
        : item.kind === "einkauf"
          ? item.store.charAt(0).toUpperCase() + item.store.slice(1)
          : "ohne Termin";

  return (
    <div className="rounded-card bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-lg">{item.title}</p>
          <p className="tnum text-sm text-ink-muted">{when}</p>
        </div>
        <span
          className="shrink-0 rounded-pill px-2.5 py-1 text-xs font-medium"
          style={{ background: "var(--color-surface-muted)", color: meta.tone }}
        >
          {meta.icon} {meta.label}
        </span>
      </div>

      {item.assignee && (
        <p className="mt-1.5 text-sm text-ink-muted">
          für {item.assignee === "constanze" ? "Constanze" : "Dirk"}
        </p>
      )}
      {item.careNeeded && item.kind === "termin" && (
        <p className="mt-1.5 text-sm text-signal">Baby-Betreuung klären</p>
      )}

      {state === "accepted" ? (
        <p className="mt-3 rounded-card bg-accent-light px-4 py-2 text-center text-sm font-medium text-ink">{note}</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await acceptSuggestionAction(item);
                setNote(r.created ? `In ${r.where} angelegt ✓` : `Übernommen — ${r.reason ?? "nicht angelegt."}`);
                setState("accepted");
              })
            }
            className="rounded-pill bg-accent px-4 py-3 font-medium text-surface disabled:opacity-60"
          >
            Übernehmen
          </button>
          <button
            disabled={pending}
            onClick={() => start(async () => { await rejectSuggestionAction(item); setState("rejected"); })}
            className="rounded-pill bg-surface-muted px-4 py-3 font-medium text-ink disabled:opacity-60"
          >
            Verwerfen
          </button>
        </div>
      )}
    </div>
  );
}
