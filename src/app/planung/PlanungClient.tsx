"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { TabBar } from "@/components/app/TabBar";
import type { WeeklyPlan, SuggestionKind } from "@/lib/ai/weekly-plan";
import type { PatternVM } from "@/lib/patterns/repository";
import {
  generatePlanAction,
  addPatternAction,
  togglePatternAction,
  deletePatternAction,
} from "./actions";

const KIND_META: Record<SuggestionKind, { label: string; dot: string }> = {
  betreuung: { label: "Betreuung", dot: "var(--color-signal)" },
  vorbereitung: { label: "Vorbereitung", dot: "var(--color-accent)" },
  fairness: { label: "Fairness", dot: "var(--color-counter)" },
  freizeit: { label: "Freizeit", dot: "var(--color-accent)" },
  sonstiges: { label: "Notiz", dot: "var(--color-ink-muted)" },
};

export function PlanungClient({
  configured,
  fairnessLabel,
  careGapCount,
  patterns,
}: {
  configured: boolean;
  fairnessLabel: string;
  careGapCount: number;
  patterns: PatternVM[];
}) {
  const [pending, start] = useTransition();
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    start(async () => {
      const res = await generatePlanAction();
      if (res.ok) setPlan(res.plan);
      else setError(res.error);
    });
  }

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-md px-5 pb-28 pt-6">
        <header className="mb-4 flex items-center gap-3">
          <Link href="/woche" className="flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-card" aria-label="Zurück">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div>
            <h1 className="font-display text-3xl">Wochenplanung</h1>
            <p className="text-sm text-ink-muted">Sonntags-Blick für Constanze und Dirk</p>
          </div>
        </header>

        {/* Auf einen Blick */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-card bg-surface p-4 shadow-card">
            <p className="eyebrow text-ink-muted">Betreuung offen</p>
            <p className="mt-1 font-display text-3xl">{careGapCount}</p>
          </div>
          <div className="rounded-card bg-surface p-4 shadow-card">
            <p className="eyebrow text-ink-muted">Fairness</p>
            <p className="mt-1 text-sm leading-snug">{fairnessLabel}</p>
          </div>
        </div>

        <button
          onClick={generate}
          disabled={pending || !configured}
          className="mt-4 w-full rounded-pill bg-accent px-5 py-3.5 font-medium text-surface disabled:opacity-60"
        >
          {pending ? "Plane die Woche …" : plan ? "Neu planen" : "Woche planen"}
        </button>
        {!configured && (
          <p className="mt-2 text-sm text-ink-muted">KI ist noch nicht konfiguriert (API-Key fehlt).</p>
        )}
        {error && <p className="mt-2 text-sm text-signal">{error}</p>}

        <AnimatePresence>
          {plan && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
              {plan.summary && (
                <div className="rounded-card bg-accent-light p-5 shadow-card">
                  <p className="font-display text-lg leading-snug">{plan.summary}</p>
                </div>
              )}
              {plan.suggestions.length > 0 && (
                <ul className="mt-4 flex flex-col gap-3">
                  {plan.suggestions.map((s, i) => {
                    const m = KIND_META[s.kind] ?? KIND_META.sonstiges;
                    return (
                      <li key={i} className="flex gap-3 rounded-card bg-surface p-4 shadow-card">
                        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.dot }} />
                        <div>
                          <p className="eyebrow text-ink-muted">{m.label}</p>
                          <p className="mt-0.5 leading-snug">{s.text}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gelernte Muster */}
        <section className="mt-10">
          <h2 className="font-display text-xl">Vorlieben &amp; Muster</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Fließt in die Planung ein. Tippen zum Aktivieren/Deaktivieren.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {patterns.map((p) => (
              <PatternRow key={p.id} pattern={p} />
            ))}
            {patterns.length === 0 && (
              <p className="text-sm text-ink-muted">Noch keine Muster hinterlegt.</p>
            )}
          </div>
          <AddPattern />
        </section>
      </div>
      <TabBar />
    </div>
  );
}

function PatternRow({ pattern }: { pattern: PatternVM }) {
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <div className="flex items-center gap-3 rounded-card bg-surface px-4 py-3 shadow-card">
      <button
        onClick={() => start(() => togglePatternAction(pattern.id))}
        disabled={pending}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
          pattern.isActive ? "border-accent bg-accent text-surface" : "border-surface-muted text-transparent"
        }`}
        aria-label={pattern.isActive ? "Deaktivieren" : "Aktivieren"}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className={`flex-1 ${pattern.isActive ? "" : "text-ink-muted line-through"}`}>{pattern.label}</span>
      <button
        onClick={() => start(async () => { await deletePatternAction(pattern.id); setGone(true); })}
        className="text-sm text-ink-muted/60"
        aria-label="Entfernen"
      >
        ✕
      </button>
    </div>
  );
}

function AddPattern() {
  const [state, formAction, pending] = useActionState(addPatternAction, { error: null });
  return (
    <form action={formAction} className="mt-3 flex gap-2">
      <input
        name="label"
        placeholder="z. B. Sonntags ist Familienzeit"
        className="flex-1 rounded-pill border border-surface-muted bg-surface px-4 py-2.5 outline-none focus:border-accent"
      />
      <button type="submit" disabled={pending} className="rounded-pill bg-ink px-4 py-2.5 text-sm font-medium text-surface disabled:opacity-60">
        Merken
      </button>
      {state?.error && <p className="text-sm text-signal">{state.error}</p>}
    </form>
  );
}
