"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { TabBar } from "@/components/app/TabBar";
import type { DayVM, EventVM } from "@/lib/calendar/view-model";

export function WeekView({
  greetingName,
  dateLabel,
  days,
}: {
  greetingName: string;
  dateLabel: string;
  days: DayVM[];
}) {
  const empty = days.length === 0;
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-md px-5 pb-28 pt-8">
        <p className="eyebrow text-ink-muted">{dateLabel}</p>
        <h1 className="mt-1 font-display text-4xl leading-tight">
          Guten Morgen, {greetingName}
        </h1>

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
