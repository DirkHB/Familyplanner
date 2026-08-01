"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Avatar } from "@/components/ui/Avatar";
import { BabyIcon } from "@/components/ui/BabyIcon";
import { AppShell } from "@/components/app/AppShell";
import type { Overview, OpenItem } from "@/lib/overview/build";
import { takeCareFromOverviewAction, dismissCareTitleAction } from "./actions";

type Tab = "woche" | "offen";

const QUESTIONS: { key: Tab; q: string }[] = [
  { key: "woche", q: "Wie sieht die Woche aus?" },
  { key: "offen", q: "Was ist noch offen?" },
];

export function UeberblickClient({
  overview,
  scopeLabel,
  briefing,
  otherHref,
  otherLabel,
  showToggle = true,
}: {
  overview: Overview;
  scopeLabel: string;
  briefing: string | null;
  otherHref: string;
  otherLabel: string;
  showToggle?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("woche");
  const openCare = overview.open.filter((o) => o.kind === "care" || o.kind === "luecke").length;
  const openTodos = overview.open.filter((o) => o.kind === "todo").length;

  return (
    <AppShell>
      <>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl">Überblick</h1>
            <p className="mt-1 text-ink-muted">{scopeLabel}</p>
          </div>
          {showToggle && (
            <Link
              href={otherHref}
              className="mt-2 shrink-0 rounded-pill bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-card"
            >
              {otherLabel}
            </Link>
          )}
        </div>

        {briefing && (
          <div className="mt-5 rounded-card bg-ink p-5 text-surface shadow-hero">
            <p className="eyebrow text-accent-light">Euer Briefing</p>
            <p className="mt-1.5 font-display text-lg leading-snug">{briefing}</p>
          </div>
        )}

        {/* Die zwei Fragen, die im Alltag zählen. „Wer macht was?" stand hier
            einmal als dritte — im Betrieb hat sie niemand gebraucht: Wer was
            übernimmt, steht bereits an den Terminen und in den Aufgaben. */}
        <div className="mt-5 flex flex-col gap-2">
          {QUESTIONS.map(({ key, q }) => {
            const active = tab === key;
            const badge =
              key === "offen" && openCare + openTodos > 0 ? openCare + openTodos : null;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center justify-between rounded-card px-4 py-3 text-left transition-colors ${
                  active ? "bg-accent text-surface shadow-card" : "bg-surface text-ink shadow-card"
                }`}
              >
                <span className="font-display text-lg">{q}</span>
                <span className="flex items-center gap-2">
                  {badge !== null && (
                    <span
                      className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${
                        active ? "bg-white/20 text-surface" : "bg-counter-light text-signal"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    style={{ transform: active ? "rotate(90deg)" : "none", transition: "transform 160ms" }}>
                    <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>
            );
          })}
        </div>

        <Link
          href="/ideen"
          className="mt-5 flex items-center justify-between rounded-card bg-surface px-4 py-3 shadow-card"
        >
          <span className="font-display text-lg">Ideen &amp; Urlaub</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-5"
          >
            {tab === "woche" && <WeekAnswer overview={overview} />}
            {tab === "offen" && <OpenAnswer overview={overview} />}
          </motion.div>
        </AnimatePresence>
      </>
    </AppShell>
  );
}

function WeekAnswer({ overview }: { overview: Overview }) {
  if (overview.days.length === 0) {
    return <Empty text="Keine Termine — der Zeitraum ist frei." />;
  }
  return (
    <div className="flex flex-col gap-4">
      {overview.days.map((d) => (
        <div key={d.key}>
          <p className="eyebrow mb-1.5 text-ink-muted">{d.label}</p>
          <div className="flex flex-col gap-1.5">
            {d.events.map((e) => (
              <Link
                key={`${e.uid}-${e.time}`}
                href={`/termin/${encodeURIComponent(e.uid)}`}
                className="flex items-center gap-3 rounded-card bg-surface px-4 py-2.5 shadow-card"
              >
                <span className="tnum w-12 shrink-0 text-sm text-ink-muted">
                  {e.allDay ? "ganztg." : e.time}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{e.title}</span>
                {e.care && <BabyIcon tone={e.care === "da" ? "da" : "offen"} />}
                {e.carePerson && <Avatar person={e.carePerson} size={20} />}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function OpenAnswer({ overview }: { overview: Overview }) {
  if (overview.open.length === 0) {
    return <Empty text="Nichts offen — alles geklärt ✓" />;
  }
  return (
    <div className="flex flex-col gap-2">
      {overview.open.map((o) =>
        o.kind === "care" ? (
          <Link
            key={`c-${o.uid}-${o.when}`}
            href={`/termin/${encodeURIComponent(o.uid)}`}
            className="flex items-center gap-3 rounded-card bg-surface px-4 py-3 shadow-card"
          >
            <BabyIcon tone="offen" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{o.label}</span>
              <span className="text-xs text-ink-muted">{o.when} · Betreuung offen</span>
            </span>
            <span className="text-sm font-medium text-accent">klären</span>
          </Link>
        ) : o.kind === "luecke" ? (
          <LueckeRow key={`l-${o.uid}-${o.when}`} item={o} />
        ) : (
          <Link
            key={`t-${o.id}`}
            href="/aufgaben"
            className="flex items-center gap-3 rounded-card bg-surface px-4 py-3 shadow-card"
          >
            <span className="h-5 w-5 shrink-0 rounded-full border-2 border-ink-muted/40" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{o.label}</span>
              {o.when && (
                <span className={`text-xs ${o.overdue ? "font-medium text-signal" : "text-ink-muted"}`}>
                  {o.when}
                  {o.overdue ? " · überfällig" : ""}
                </span>
              )}
            </span>
          </Link>
        ),
      )}
    </div>
  );
}

/**
 * Eine noch gar nicht besprochene Betreuung. Zwei Wege raus, beide ein Tipp:
 * „Ich" übernimmt sie, „nicht nötig" gilt ab dann für alle Termine dieses
 * Titels — sonst müsste man die wöchentliche Müllabfuhr jede Woche abwinken.
 */
function LueckeRow({ item }: { item: Extract<OpenItem, { kind: "luecke" }> }) {
  const [pending, start] = useTransition();
  const [weg, setWeg] = useState(false);
  if (weg) return null;

  return (
    <div className="rounded-card bg-surface px-4 py-3 shadow-card">
      <div className="flex items-center gap-3">
        <BabyIcon tone="offen" />
        <span className="min-w-0 flex-1">
          <Link href={`/termin/${encodeURIComponent(item.uid)}`} className="block truncate font-medium">
            {item.label}
          </Link>
          <span className="text-xs text-ink-muted">{item.when} · wer ist bei Nicolas?</span>
        </span>
      </div>
      <div className="mt-2.5 flex gap-2">
        {item.occurrenceISO && (
          <button
            disabled={pending}
            onClick={() =>
              start(async () => {
                await takeCareFromOverviewAction(item.uid, item.occurrenceISO!);
                setWeg(true);
              })
            }
            className="rounded-pill bg-accent px-4 py-2 text-sm font-medium text-surface disabled:opacity-60"
          >
            Ich mach das
          </button>
        )}
        <Link
          href={`/termin/${encodeURIComponent(item.uid)}`}
          className="rounded-pill bg-surface-muted px-4 py-2 text-sm font-medium text-ink"
        >
          Fragen
        </Link>
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              await dismissCareTitleAction(item.label);
              setWeg(true);
            })
          }
          className="ml-auto px-2 py-2 text-sm text-ink-muted/70 disabled:opacity-60"
        >
          nicht nötig
        </button>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-card bg-surface p-6 text-center shadow-card">
      <p className="font-display text-xl">{text}</p>
    </div>
  );
}
