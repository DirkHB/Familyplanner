"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { neuerTerminAction } from "@/app/termine/actions";
import { BabyIcon } from "@/components/ui/BabyIcon";
import type { MonthCell } from "@/lib/calendar/month";
import { useHaushaltNamen } from "@/components/app/HaushaltContext";
import { PLATZ_A, PLATZ_B, andererPlatz, type Platz } from "@/lib/haushalt/platz";

/**
 * Der Monatsstrom: alle Monate untereinander, durchgehend scrollbar wie im
 * Apple Kalender. Kein Blättern, keine Karten-Boxen — ein flaches Raster mit
 * Haarlinien, die Wochentagszeile klebt oben, die Monatstitel ziehen im
 * Fluss vorbei.
 *
 * Ein Tipp auf einen Tag öffnet das Tages-Blatt: die Termine des Tages und
 * der Weg zu „Neuer Termin". Das ersetzt die alte Zwei-Tipp-Logik — im
 * Endlos-Strom gibt es keine Tagesliste mehr, zu der man springen könnte.
 *
 * Für die Flüssigkeit rendert der Browser nur, was im Bild ist:
 * content-visibility überspringt Monate außerhalb des Ausschnitts, die
 * geschätzte Höhe hält die Scrollleiste ruhig.
 */

export type TagInfo = { chips: { t: string; c: string }[]; n: number };
export type StromMonat = { key: string; monat: string; jahr: string; weeks: MonthCell[][] };

const ZEILEN_HOEHE = 76; // eine Rasterzeile inkl. Haarlinie
const TITEL_HOEHE = 64; // Monatstitel mit Abstand

export function MonatsStrom({
  monate,
  eventsByDay,
  todayKey,
  meinPlatz = PLATZ_A,
}: {
  monate: StromMonat[];
  eventsByDay: Record<string, TagInfo>;
  todayKey: string;
  /** Wer gerade angemeldet ist — die Vorgabe für „Kalender von". */
  meinPlatz?: Platz;
}) {
  const [blattTag, setBlattTag] = useState<string | null>(null);

  return (
    <>
      {/* Die Wochentage bleiben oben stehen — sonst weiß man drei Monate
          tiefer nicht mehr, welche Spalte der Samstag ist. */}
      <div className="sticky top-0 z-20 -mx-5 border-b border-surface-muted/70 bg-bg/90 px-5" style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
        <div className="grid grid-cols-7 py-2 text-center">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w, i) => (
            <span
              key={w}
              className="text-[11px] font-medium text-ink-muted"
              style={i >= 5 ? { opacity: 0.6 } : undefined}
            >
              {w}
            </span>
          ))}
        </div>
      </div>

      {monate.map((m) => (
        <section
          key={m.key}
          style={{
            contentVisibility: "auto",
            containIntrinsicSize: `auto ${TITEL_HOEHE + m.weeks.length * ZEILEN_HOEHE}px`,
          }}
        >
          <h2 className="pb-2 pt-6 font-display text-2xl">
            {m.monat} <span className="text-ink-muted">{m.jahr}</span>
          </h2>
          {m.weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-t border-surface-muted/60">
              {week.map((cell) =>
                cell.inMonth ? (
                  <TagZelle
                    key={cell.key}
                    cell={cell}
                    info={eventsByDay[cell.key]}
                    heute={cell.key === todayKey}
                    onTipp={() => setBlattTag(cell.key)}
                  />
                ) : (
                  // Randtage gehören dem Nachbarmonat — hier bleibt Luft,
                  // genau wie im Apple Kalender.
                  <span key={cell.key} aria-hidden className="min-h-[75px]" />
                ),
              )}
            </div>
          ))}
        </section>
      ))}

      <AnimatePresence>
        {blattTag && (
          <TagesBlatt
            tag={blattTag}
            erwartet={eventsByDay[blattTag]?.n ?? 0}
            meinPlatz={meinPlatz}
            onClose={() => setBlattTag(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function TagZelle({
  cell,
  info,
  heute,
  onTipp,
}: {
  cell: MonthCell;
  info: TagInfo | undefined;
  heute: boolean;
  onTipp: () => void;
}) {
  const chips = info?.chips ?? [];
  const mehr = (info?.n ?? 0) - chips.length;
  return (
    <button
      onClick={onTipp}
      aria-label={`Tag ${cell.day}`}
      className="flex min-h-[75px] min-w-0 flex-col gap-[3px] px-[3px] pb-1.5 pt-1 text-left"
    >
      <span
        className={`tnum grid h-[22px] w-[22px] shrink-0 place-items-center self-center rounded-full text-[12px] leading-none ${
          heute ? "bg-accent font-semibold text-surface" : "text-ink"
        }`}
      >
        {cell.day}
      </span>
      {chips.map((chip, i) => (
        <span
          key={i}
          className="block truncate rounded-[4px] bg-surface pl-1 pr-0.5 text-[9px] font-medium leading-[1.5] text-ink"
          style={{ boxShadow: `inset 2px 0 0 ${chip.c}` }}
        >
          {chip.t}
        </span>
      ))}
      {mehr > 0 && <span className="pl-1 text-[9px] leading-none text-ink-muted">+{mehr}</span>}
    </button>
  );
}

/* ------------------------------- Tages-Blatt ------------------------------- */

const tagFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Berlin",
});

type TagEvent = {
  href: string;
  title: string;
  time: string;
  allDay: boolean;
  dotColor: string;
  care: "offen" | "da" | null;
};

/**
 * Das Tages-Blatt: erst die Termine des Tages (frisch vom Server, das Raster
 * kennt nur Kurzformen), dann der Weg zum Anlegen. Beides in einem Blatt —
 * mit einem Daumen erreichbar, ohne die Ansicht zu verlassen.
 */
function TagesBlatt({
  tag,
  erwartet,
  meinPlatz,
  onClose,
}: {
  tag: string;
  erwartet: number;
  meinPlatz: Platz;
  onClose: () => void;
}) {
  const [events, setEvents] = useState<TagEvent[] | null>(null);
  const [anlegen, setAnlegen] = useState(false);

  useEffect(() => {
    let weg = false;
    setEvents(null);
    fetch(`/api/tag?d=${tag}`)
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => {
        if (!weg) setEvents(Array.isArray(d.events) ? d.events : []);
      })
      .catch(() => {
        if (!weg) setEvents([]);
      });
    return () => {
      weg = true;
    };
  }, [tag]);

  return (
    <div className="fixed inset-0 z-50">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-label="Schließen"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 420, damping: 40 }}
        className="absolute inset-x-0 bottom-0 rounded-t-[20px] bg-bg p-5 shadow-hero"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <h2 className="font-display text-2xl">{tagFmt.format(new Date(`${tag}T12:00:00Z`))}</h2>

        {anlegen ? (
          <NeuerTerminFelder tag={tag} meinPlatz={meinPlatz} onClose={onClose} />
        ) : (
          <>
            <div className="mt-4 flex max-h-[45dvh] flex-col gap-2 overflow-y-auto">
              {events === null &&
                Array.from({ length: Math.max(1, Math.min(erwartet, 4)) }, (_, i) => (
                  <div key={i} className="h-[46px] animate-pulse rounded-card bg-surface" />
                ))}
              {events?.map((ev) => (
                <Link
                  key={ev.href + ev.time}
                  href={ev.href}
                  className="flex items-center gap-3 rounded-card bg-surface px-4 py-3 shadow-card"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ev.dotColor }} />
                  <span className="min-w-0 flex-1 truncate font-medium">{ev.title}</span>
                  {ev.care && <BabyIcon tone={ev.care} />}
                  <span className="tnum shrink-0 text-sm text-ink-muted">
                    {ev.allDay ? "ganztägig" : ev.time}
                  </span>
                </Link>
              ))}
              {events?.length === 0 && (
                <p className="py-2 text-ink-muted">Noch nichts geplant — der Tag gehört euch.</p>
              )}
            </div>
            <button
              onClick={() => setAnlegen(true)}
              className="mt-4 w-full rounded-pill bg-accent px-5 py-3.5 font-medium text-surface"
            >
              Neuer Termin
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}

/** Titel, Zeit, fertig — der Tag ist schon gewählt. */
function NeuerTerminFelder({
  tag,
  meinPlatz,
  onClose,
}: {
  tag: string;
  meinPlatz: Platz;
  onClose: () => void;
}) {
  const namen = useHaushaltNamen();
  const [fuerPlatz, setFuerPlatz] = useState<Platz>(meinPlatz);
  const [titel, setTitel] = useState("");
  const [von, setVon] = useState("09:00");
  const [bis, setBis] = useState("10:00");
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function anlegen() {
    if (!titel.trim() || pending) return;
    start(async () => {
      const r = await neuerTerminAction({ titel, tag, von, bis, fuerPlatz });
      if (r.ok) {
        onClose();
        router.refresh();
      } else {
        setFehler(r.grund ?? "Hat nicht geklappt.");
      }
    });
  }

  return (
    <>
      <input
        autoFocus
        value={titel}
        onChange={(e) => {
          setTitel(e.target.value);
          setFehler(null);
        }}
        onKeyDown={(e) => e.key === "Enter" && anlegen()}
        placeholder="Was steht an?"
        className="mt-4 w-full rounded-card border border-surface-muted bg-surface px-4 py-3 outline-none focus:border-accent"
      />
      <div className="mt-3 flex items-center gap-2">
        <input
          type="time"
          value={von}
          onChange={(e) => setVon(e.target.value)}
          aria-label="Beginn"
          className="min-w-0 flex-1 appearance-none rounded-card border border-surface-muted bg-surface px-3 py-2.5 text-base outline-none focus:border-accent"
        />
        <span className="text-ink-muted">bis</span>
        <input
          type="time"
          value={bis}
          onChange={(e) => setBis(e.target.value)}
          aria-label="Ende"
          className="min-w-0 flex-1 appearance-none rounded-card border border-surface-muted bg-surface px-3 py-2.5 text-base outline-none focus:border-accent"
        />
      </div>
      <KalenderVon
        gewaehlt={fuerPlatz}
        namen={namen}
        onWechsel={() => setFuerPlatz(andererPlatz(fuerPlatz))}
      />

      <button
        onClick={anlegen}
        disabled={pending || !titel.trim()}
        className="mt-4 w-full rounded-pill bg-accent px-5 py-3.5 font-medium text-surface disabled:opacity-50"
      >
        {pending ? "Lege an …" : "In den Kalender"}
      </button>
      {fehler && <p className="mt-2 text-sm text-signal">{fehler}</p>}
    </>
  );
}

/**
 * „Kalender von" — in wessen Kalender der neue Termin geschrieben wird.
 *
 * Steht auf einem selbst, weil das fast immer stimmt. Ein Tipp wechselt zum
 * anderen: für den Zahnarzttermin, den man für ihn ausgemacht hat, oder das
 * Treffen, zu dem nur sie geht. Ohne diesen Schalter landet alles im selben
 * Kalender, und dann steht im Telefon des einen, was den anderen betrifft.
 *
 * Bewusst leise: eine Zeile, kein Formularfeld. Wer sie nicht braucht, liest
 * darüber hinweg — aber sie sagt vorher, wohin es geht, statt hinterher.
 */
function KalenderVon({
  gewaehlt,
  namen,
  onWechsel,
}: {
  gewaehlt: Platz;
  namen: Record<Platz, string>;
  onWechsel: () => void;
}) {
  const andere = gewaehlt === PLATZ_A ? PLATZ_B : PLATZ_A;
  // Ohne Namen (frisch eingerichtet) hilft die Zeile niemandem.
  if (!namen[gewaehlt] || !namen[andere]) return null;

  return (
    <div className="mt-3 flex items-center gap-2 text-sm">
      <span className="text-ink-muted">Kalender von</span>
      <button
        onClick={onWechsel}
        className="inline-flex items-center gap-1.5 rounded-pill bg-surface-muted px-3 py-1.5 font-medium text-ink"
      >
        {namen[gewaehlt]}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M7 8h11M7 8l3-3M7 8l3 3M17 16H6m11 0l-3-3m3 3l-3 3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <span className="sr-only">Tippen, um zu {namen[andere]} zu wechseln</span>
    </div>
  );
}
