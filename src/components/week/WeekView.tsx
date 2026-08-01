"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { Avatar } from "@/components/ui/Avatar";
import { BabyIcon } from "@/components/ui/BabyIcon";
import { AppShell } from "@/components/app/AppShell";
import { RequestHero } from "@/components/requests/RequestHero";
import type { DayVM, EventVM } from "@/lib/calendar/view-model";
import type { RequestVM } from "@/lib/requests/view-model";
import { takeCareAction, requestCareAction } from "@/app/termin/[uid]/actions";

export function WeekView({
  greetingName,
  greeting = "Guten Morgen",
  dateLabel,
  days,
  requests = [],
  nextTodayKey = null,
}: {
  greetingName: string;
  greeting?: string;
  dateLabel: string;
  days: DayVM[];
  requests?: RequestVM[];
  /** Schlüssel des nächsten noch anstehenden Termins heute — wird hervorgehoben. */
  nextTodayKey?: string | null;
}) {
  const empty = days.length === 0;
  return (
    <AppShell floating={<FabErfassen />}>
      <>
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow text-ink-muted">{dateLabel}</p>
            <h1 className="mt-1 font-display text-4xl leading-tight">
              {greeting}, {greetingName}
            </h1>
          </div>
          <div className="mt-1 flex shrink-0 items-center gap-2">
            <Link
              href="/einstellungen"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-card"
              aria-label="Einstellungen"
            >
              {/* Klassisches Zahnrad — die frühere Strahlen-Variante wurde als Sonne gelesen.
                  Ohne Beschriftung: das Zahnrad ist als Symbol eindeutig genug, und der
                  runde Knopf entspricht den anderen Icon-Knöpfen (Monatsnavigation, +). */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.7" />
                <path
                  d="M19.1 13.6a7.6 7.6 0 0 0 0-3.2l1.9-1.4-1.9-3.3-2.2.9a7.6 7.6 0 0 0-2.8-1.6L13.7 2h-3.4l-.4 2.4a7.6 7.6 0 0 0-2.8 1.6l-2.2-.9L3 8.4l1.9 1.4a7.6 7.6 0 0 0 0 3.2L3 14.4l1.9 3.3 2.2-.9a7.6 7.6 0 0 0 2.8 1.6l.4 2.4h3.4l.4-2.4a7.6 7.6 0 0 0 2.8-1.6l2.2.9 1.9-3.3-1.9-1.4Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </div>

        <RequestHero requests={requests} />

        {empty ? (
          <EmptyState />
        ) : (
          <div className="mt-8 flex flex-col gap-6">
            {days.map((day) => (
              <DaySection key={day.key} day={day} nextTodayKey={nextTodayKey} />
            ))}
          </div>
        )}
      </>
    </AppShell>
  );
}

/** Schwebender Erfassen-Knopf — liegt in der App-Huelle, scrollt nie mit. */
function FabErfassen() {
  return (
    <Link
      href="/erfassen"
      aria-label="Schnell erfassen"
      className="absolute right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-surface shadow-hero transition-transform duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-95"
      style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </Link>
  );
}

function DaySection({ day, nextTodayKey }: { day: DayVM; nextTodayKey: string | null }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3">
        {/* Heute heißt „Heute" — die eigene Karte darüber zeigte bis eben
            denselben Termin ein zweites Mal und ist ersatzlos entfallen. */}
        <h2 className={`font-display text-xl ${day.isToday ? "text-ink" : "text-ink-muted"}`}>
          {day.isToday ? "Heute" : day.weekday}
        </h2>
        <span className="h-px flex-1 bg-surface-muted" />
        <span className="tnum text-ink-muted">{day.dayNumber}.</span>
      </div>
      <div className="flex flex-col gap-3">
        {day.events.map((ev, i) => (
          <EventRow key={ev.key} ev={ev} index={i} isNext={ev.key === nextTodayKey} />
        ))}
      </div>
    </section>
  );
}

function EventRow({ ev, index, isNext = false }: { ev: EventVM; index: number; isNext?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.03, 0.15), ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={ev.href}
        className="flex items-stretch gap-4 rounded-card bg-surface p-4 shadow-card transition-transform duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.99]"
      >
        <div className={`tnum flex w-14 shrink-0 items-center font-display text-lg ${isNext ? "text-accent" : ""}`}>
          {ev.allDay ? <span className="text-sm text-ink-muted">ganztägig</span> : ev.time}
        </div>
        <div className="w-px shrink-0" style={{ background: ev.dotColor, opacity: 0.35 }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ev.dotColor }} />
            <span className="truncate text-lg font-semibold">{ev.title}</span>
            {ev.care && (
              <span className="ml-auto flex shrink-0 items-center gap-1">
                {ev.care.status === "offen" && ev.occurrenceISO ? (
                  <CareQuickAction uid={ev.uid} occurrenceISO={ev.occurrenceISO} title={ev.title} />
                ) : (
                  <BabyIcon tone={ev.care.status === "offen" ? "offen" : "da"} />
                )}
                {ev.care.person && <Avatar person={ev.care.person} size={20} />}
              </span>
            )}
          </div>
          {ev.notesPreview && (
            <p className="mt-1 truncate text-xs text-ink-muted">{ev.notesPreview}</p>
          )}
          {(ev.people.length > 0 || ev.openCount > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {ev.people.length > 0 && (
                <span className="flex -space-x-1.5">
                  {ev.people.map((p) => (
                    <Avatar key={p} person={p} size={22} />
                  ))}
                </span>
              )}
              {ev.openCount > 0 && (
                <span className="rounded-pill bg-counter-light px-2 py-0.5 text-xs font-medium text-signal">
                  {ev.openCount} offen
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 rounded-card bg-surface p-6 text-center shadow-card">
      <p className="font-display text-xl">Diese Woche ist noch frei</p>
      <p className="mt-2 text-ink-muted">
        Sobald euer iCloud-Kalender verbunden ist, tauchen hier eure Termine auf.
      </p>
      <Link
        href="/einstellungen"
        className="mt-5 inline-flex rounded-pill bg-ink px-5 py-3 font-medium text-surface"
      >
        Kalender verbinden
      </Link>
    </div>
  );
}


/** Betreuung direkt aus der Liste klären — ohne Umweg über das Termin-Detail. */
function CareQuickAction({
  uid,
  occurrenceISO,
  title,
}: {
  uid: string;
  occurrenceISO: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done) return <span className="text-xs font-medium text-accent">{done}</span>;

  return (
    <span className="relative">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        aria-label="Betreuung klären"
      >
        <BabyIcon tone="offen" />
      </button>
      {open && (
        <span
          className="absolute right-0 top-8 z-20 flex w-44 flex-col overflow-hidden rounded-card bg-surface shadow-hero"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <button
            disabled={pending}
            onClick={() => start(async () => { await takeCareAction(uid, occurrenceISO); setDone("Du machst es ✓"); })}
            className="px-4 py-2.5 text-left text-sm font-medium text-ink"
          >
            Ich mache es
          </button>
          <button
            disabled={pending}
            onClick={() => start(async () => { await requestCareAction(uid, occurrenceISO, title); setDone("Gefragt ✓"); })}
            className="border-t border-surface-muted/60 px-4 py-2.5 text-left text-sm text-ink"
          >
            Den anderen fragen
          </button>
        </span>
      )}
    </span>
  );
}
