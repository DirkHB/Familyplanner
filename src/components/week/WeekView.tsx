"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { TabBar } from "@/components/app/TabBar";
import { RequestHero } from "@/components/requests/RequestHero";
import type { DayVM, EventVM } from "@/lib/calendar/view-model";
import type { RequestVM } from "@/lib/requests/view-model";

export function WeekView({
  greetingName,
  greeting = "Guten Morgen",
  dateLabel,
  days,
  requests = [],
}: {
  greetingName: string;
  greeting?: string;
  dateLabel: string;
  days: DayVM[];
  requests?: RequestVM[];
}) {
  const empty = days.length === 0;
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-md px-5 pb-28 pt-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow text-ink-muted">{dateLabel}</p>
            <h1 className="mt-1 font-display text-4xl leading-tight">
              {greeting}, {greetingName}
            </h1>
          </div>
          <div className="mt-1 flex shrink-0 items-center gap-2">
            <Link
              href="/erfassen"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-surface shadow-card"
              aria-label="Schnell erfassen"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </Link>
            <Link
              href="/planung"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-card"
              aria-label="Wochenplanung"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 3l2.09 4.26L19 8l-3.5 3.4.8 4.8L12 14l-4.3 2.2.8-4.8L5 8l4.91-.74L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="/einstellungen"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-card"
              aria-label="Einstellungen"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
              <DaySection key={day.key} day={day} />
            ))}
          </div>
        )}
      </div>
      <TabBar />
    </div>
  );
}

function DaySection({ day }: { day: DayVM }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className={`font-display text-xl ${day.isToday ? "text-ink" : "text-ink-muted"}`}>
          {day.weekday}
        </h2>
        <span className="h-px flex-1 bg-surface-muted" />
        <span className="tnum text-ink-muted">{day.dayNumber}.</span>
      </div>
      <div className="flex flex-col gap-3">
        {day.events.map((ev, i) => (
          <EventRow key={ev.key} ev={ev} index={i} />
        ))}
      </div>
    </section>
  );
}

function EventRow({ ev, index }: { ev: EventVM; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.03, 0.15), ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={ev.href}
        className="flex items-stretch gap-4 rounded-card bg-surface p-4 shadow-card active:scale-[0.99]"
        style={{ transition: "transform 120ms cubic-bezier(0.16,1,0.3,1)" }}
      >
        <div className="tnum flex w-14 shrink-0 items-center font-display text-lg">
          {ev.allDay ? <span className="text-sm text-ink-muted">ganztägig</span> : ev.time}
        </div>
        <div className="w-px shrink-0" style={{ background: ev.dotColor, opacity: 0.35 }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ev.dotColor }} />
            <span className="truncate text-lg font-semibold">{ev.title}</span>
          </div>
          {(ev.people.length > 0 || ev.care || ev.openCount > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {ev.people.length > 0 && (
                <span className="flex -space-x-1.5">
                  {ev.people.map((p) => (
                    <Avatar key={p} person={p} size={22} />
                  ))}
                </span>
              )}
              {ev.care && (
                <Badge tone={ev.care.status === "offen" ? "offen" : ev.care.status === "da" ? "da" : "geklaert"}>
                  {ev.care.label}
                </Badge>
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
