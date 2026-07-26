"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/Badge";
import { captureAction, acceptSuggestionAction, rejectSuggestionAction } from "./actions";
import type { CaptureEvent } from "@/lib/ai/schemas";

const timeFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});
const dateFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/Berlin",
});

export function ErfassenClient({ configured }: { configured: boolean }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [events, setEvents] = useState<CaptureEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function analyze() {
    setError(null);
    start(async () => {
      const res = await captureAction(text);
      if (res.ok) setEvents(res.result.events);
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
          <h1 className="font-display text-3xl">Schnell erfassen</h1>
        </header>

        <p className="mb-3 text-ink-muted">
          Schreib einfach los — z. B. „Donnerstag 15 Uhr Kinderarzt U3, danach einkaufen".
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Was steht an?"
          className="w-full resize-none rounded-card border border-surface-muted bg-surface p-4 outline-none focus:border-accent"
        />
        <button
          onClick={analyze}
          disabled={pending || !configured}
          className="mt-3 w-full rounded-pill bg-accent px-5 py-3.5 font-medium text-surface disabled:opacity-60"
        >
          {pending ? "Denke nach …" : "Vorschlag erstellen"}
        </button>
        {!configured && (
          <p className="mt-2 text-sm text-ink-muted">KI ist noch nicht konfiguriert (API-Key fehlt).</p>
        )}
        {error && <p className="mt-2 text-sm text-signal">{error}</p>}

        <AnimatePresence>
          {events && events.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 flex flex-col gap-3"
            >
              <p className="eyebrow text-ink-muted">Vorschau · übernehmen oder verwerfen</p>
              {events.map((ev, i) => (
                <SuggestionCard key={i} ev={ev} />
              ))}
            </motion.div>
          )}
          {events && events.length === 0 && (
            <p className="mt-6 text-ink-muted">Daraus konnte ich keinen Termin ableiten.</p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SuggestionCard({ ev }: { ev: CaptureEvent }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<"open" | "accepted" | "rejected">("open");
  const [note, setNote] = useState("");

  if (state === "rejected") return null;

  const when = ev.allDay
    ? `${dateFmt.format(new Date(ev.start))} · ganztägig`
    : timeFmt.format(new Date(ev.start));

  return (
    <div className="rounded-card bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg">{ev.title}</p>
          <p className="tnum text-sm text-ink-muted">{when}</p>
        </div>
        <Badge tone="neutral">{ev.category}</Badge>
      </div>

      {ev.checklist.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {ev.checklist.map((c, i) => (
            <li key={i} className="rounded-pill bg-surface-muted px-2.5 py-1 text-xs text-ink-muted">
              {c}
            </li>
          ))}
        </ul>
      )}
      {ev.careNeeded && (
        <p className="mt-2 text-sm text-signal">Baby-Betreuung klären</p>
      )}

      {state === "accepted" ? (
        <p className="mt-3 rounded-card bg-accent-light px-4 py-2 text-center text-sm font-medium text-ink">
          {note}
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await acceptSuggestionAction(ev);
                setNote(
                  r.created
                    ? "Im Kalender angelegt ✓"
                    : `Übernommen — ${r.reason ?? "Kalender noch nicht verbunden."}`,
                );
                setState("accepted");
              })
            }
            className="rounded-pill bg-accent px-4 py-3 font-medium text-surface disabled:opacity-60"
          >
            Übernehmen
          </button>
          <button
            disabled={pending}
            onClick={() => start(async () => { await rejectSuggestionAction(ev); setState("rejected"); })}
            className="rounded-pill bg-surface-muted px-4 py-3 font-medium text-ink disabled:opacity-60"
          >
            Verwerfen
          </button>
        </div>
      )}
    </div>
  );
}
