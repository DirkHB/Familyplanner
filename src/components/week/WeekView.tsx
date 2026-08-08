"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { motion } from "motion/react";
import { Avatar } from "@/components/ui/Avatar";
import { BabyIcon } from "@/components/ui/BabyIcon";
import { AppShell } from "@/components/app/AppShell";
import { FabErfassen } from "@/components/app/FabErfassen";
import { RequestHero } from "@/components/requests/RequestHero";
import type { DayVM, EventVM } from "@/lib/calendar/view-model";
import { STANDARD_FENSTER, type TagesFenster } from "@/lib/calendar/zeitstrahl";
import type { RequestVM } from "@/lib/requests/view-model";
import { takeCareAction, requestCareAction } from "@/app/termin/[uid]/actions";

export function WeekView({
  greetingName,
  greeting = "Guten Morgen",
  dateLabel,
  days,
  requests = [],
  nextTodayKey = null,
  fenster = STANDARD_FENSTER,
  briefing = null,
  naechsteWoche = false,
}: {
  greetingName: string;
  greeting?: string;
  dateLabel: string;
  days: DayVM[];
  requests?: RequestVM[];
  /** Schlüssel des nächsten noch anstehenden Termins heute — wird hervorgehoben. */
  nextTodayKey?: string | null;
  /** Tagesfenster für die Randmarken des Zeitstrahls (je Person einstellbar). */
  fenster?: TagesFenster;
  /** Der Zwei-Zeilen-Blick auf den Tag — lebte früher im Überblick. */
  briefing?: string | null;
  naechsteWoche?: boolean;
}) {
  const empty = days.length === 0;
  return (
    <AppShell floating={<FabErfassen />}>
      <>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow text-ink-muted">{dateLabel}</p>
            <h1 className="mt-1 font-display text-4xl leading-tight">
              {greeting}, {greetingName}
            </h1>
          </div>
          {/* Blättern sitzt, wo früher das Zahnrad war. */}
          <Link
            href={naechsteWoche ? "/woche" : "/woche?w=1"}
            className="mt-1 shrink-0 rounded-pill bg-surface px-3.5 py-2 text-sm font-medium text-ink shadow-card"
          >
            {naechsteWoche ? "← Zurück" : "Nächste →"}
          </Link>
        </div>

        {/* Das Briefing in voller Breite. Sofort steht die nüchterne
            Kopfzeile da; der Assistent zieht nach, sobald er geantwortet
            hat — die Seite wartet nie auf die KI. */}
        {briefing && !naechsteWoche && <BriefingZeile fallback={briefing} />}

        <RequestHero requests={requests} />

        {empty ? (
          <EmptyState />
        ) : (
          <div className="mt-8 flex flex-col gap-6">
            {days.map((day) => (
              <DaySection key={day.key} day={day} nextTodayKey={nextTodayKey} fenster={fenster} />
            ))}
          </div>
        )}
      </>
    </AppShell>
  );
}

/**
 * Die Briefing-Zeile: zeigt sofort die berechnete Kopfzeile und tauscht sie
 * gegen das Assistenten-Briefing, sobald es da ist. Meist kommt es aus dem
 * Cache und ist schneller da, als man liest.
 */
function BriefingZeile({ fallback }: { fallback: string }) {
  const [text, setText] = useState(fallback);
  useEffect(() => {
    let weg = false;
    fetch("/api/briefing")
      .then((r) => (r.ok ? r.json() : { text: null }))
      .then((d) => {
        if (!weg && typeof d.text === "string" && d.text) setText(d.text);
      })
      .catch(() => {});
    return () => {
      weg = true;
    };
  }, []);
  return (
    <motion.p
      key={text}
      initial={{ opacity: 0.6 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="mt-3 text-[15px] leading-snug text-ink"
    >
      {text}
    </motion.p>
  );
}

function DaySection({
  day,
  nextTodayKey,
  fenster,
}: {
  day: DayVM;
  nextTodayKey: string | null;
  fenster: TagesFenster;
}) {
  const byKey = new Map(day.events.map((e) => [e.key, e]));
  const ganztags = day.events.filter((e) => e.allDay);
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

      {ganztags.length > 0 && (
        <div className="mb-3 flex flex-col gap-1">
          {ganztags.map((ev) => (
            <KulisseZeile key={ev.key} ev={ev} />
          ))}
        </div>
      )}

      {/* Der Zeitstrahl: eine stille Linie am linken Rand, Punkte an den
          Termingruppen, gestrichelte Marken für freie Blöcke. Freie Blöcke
          sind bewusst immer gleich hoch — die Frage ist „ist da Luft?",
          die Dauer steht als Text dran. */}
      <div className="relative pl-4">
        <span aria-hidden className="absolute bottom-1 left-[3px] top-1 w-px bg-surface-muted" />
        <p className="tnum mb-1 text-[11px] leading-none text-ink-muted/60">{fenster.vonStunde} Uhr</p>
        <div className="flex flex-col gap-2.5">
          {day.strahl.map((seg, i) =>
            seg.art === "frei" ? (
              <div key={`frei-${i}`} className="relative flex h-7 items-center">
                <span aria-hidden className="absolute -left-4 top-1/2 ml-[3px] h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink-muted/50 bg-bg" />
                <span className="rounded-pill border border-dashed border-ink-muted/35 px-2.5 py-0.5 text-[11px] text-ink-muted/80">
                  {seg.label}
                </span>
              </div>
            ) : (
              <div key={seg.keys.join("+")} className="relative">
                <span aria-hidden className="absolute -left-4 top-6 ml-[3px] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-ink-muted/60" />
                {seg.keys.length === 1 ? (
                  <EventRow ev={byKey.get(seg.keys[0])!} index={i} isNext={seg.keys[0] === nextTodayKey} />
                ) : (
                  /* Parallele Termine: nebeneinander, kompakt. */
                  <div className="grid grid-cols-2 gap-2">
                    {seg.keys.map((k) => (
                      <EventRow key={k} ev={byKey.get(k)!} index={i} isNext={k === nextTodayKey} kompakt />
                    ))}
                  </div>
                )}
              </div>
            ),
          )}
        </div>
        <p className="tnum mt-1 text-[11px] leading-none text-ink-muted/60">{fenster.bisStunde} Uhr</p>
      </div>
    </section>
  );
}

/**
 * Ganztägiges ist meistens gar kein Termin, sondern Kulisse: ein Geburtstag,
 * ein Besuch, eine Hochzeit. Es sagt, wie der Tag gestimmt ist — nicht, wo man
 * um halb vier zu sein hat. Als Terminkarte hat es genau das behauptet und
 * dem Tag ein „ganztägig" vorangestellt, das nichts erklärt.
 *
 * Deshalb: keine Karte, kein Schatten, keine Uhrzeitspalte. Eine ruhige Zeile
 * über dem Tag. Antippbar bleibt sie — an einer Hochzeit hängt ein Geschenk,
 * an einem Besuch hängt eine Frage.
 */
function KulisseZeile({ ev }: { ev: EventVM }) {
  return (
    <Link
      href={ev.href}
      className="-mx-1 flex items-center gap-2 rounded-card px-1 py-0.5 transition-transform duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.99]"
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: ev.dotColor, opacity: ev.past ? 0.35 : 0.9 }}
      />
      <span className={`truncate text-[15px] ${ev.past ? "text-ink-muted line-through" : "text-ink"}`}>
        {ev.title}
      </span>
      {ev.openCount > 0 && (
        <span className="ml-auto shrink-0 rounded-pill bg-counter-light px-2 py-0.5 text-xs font-medium text-signal">
          {ev.openCount} offen
        </span>
      )}
    </Link>
  );
}

function EventRow({
  ev,
  index,
  isNext = false,
  kompakt = false,
}: {
  ev: EventVM;
  index: number;
  isNext?: boolean;
  /** Halbbreit neben einem parallelen Termin: Zeit über dem Titel, ohne Beiwerk. */
  kompakt?: boolean;
}) {
  if (kompakt) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: Math.min(index * 0.03, 0.15), ease: [0.16, 1, 0.3, 1] }}
        className="min-w-0"
      >
        <Link
          href={ev.href}
          className="block h-full rounded-card bg-surface p-3 shadow-card transition-transform duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.99]"
        >
          <p className={`tnum font-display text-base ${isNext ? "text-accent" : ""} ${ev.past ? "text-ink-muted line-through" : ""}`}>
            {ev.time}
          </p>
          <p className={`mt-0.5 flex items-center gap-1.5 ${ev.past ? "text-ink-muted line-through" : ""}`}>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ev.dotColor, opacity: ev.past ? 0.4 : 1 }} />
            <span className="truncate font-semibold">{ev.title}</span>
          </p>
          {ev.care && (
            <span className="mt-1.5 flex items-center gap-1">
              <BabyIcon tone={ev.care.status === "offen" ? "offen" : "da"} />
              {ev.care.person && <Avatar person={ev.care.person} size={18} />}
            </span>
          )}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.03, 0.15), ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Vorbei heißt durchgestrichen, nicht unlesbar: Deckkraft und graue
          Schrift zusammen ergaben 1.1:1 — weit unter WCAG AA. Jetzt trägt
          allein die Schrift die Aussage, die Karte bleibt voll deckend. */}
      <Link
        href={ev.href}
        className="flex items-stretch gap-4 rounded-card bg-surface p-4 shadow-card transition-transform duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.99]"
      >
        <div
          className={`tnum flex w-14 shrink-0 items-center font-display text-lg ${
            isNext ? "text-accent" : ""
          } ${ev.past ? "text-ink-muted line-through" : ""}`}
        >
          {/* Nur Termine mit Uhrzeit landen hier — Ganztägiges läuft über
              KulisseZeile, der Zeitstrahl kennt es gar nicht erst. */}
          {ev.time}
        </div>
        <div className="w-px shrink-0" style={{ background: ev.dotColor, opacity: ev.past ? 0.15 : 0.35 }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: ev.dotColor, opacity: ev.past ? 0.4 : 1 }}
            />
            <span className={`truncate text-lg font-semibold ${ev.past ? "text-ink-muted line-through" : ""}`}>
              {ev.title}
            </span>
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
