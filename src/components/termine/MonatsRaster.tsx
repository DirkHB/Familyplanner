"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { neuerTerminAction } from "@/app/termine/actions";

/**
 * Das Monatsraster mit zwei Tipp-Stufen:
 *
 *   1. Tipp auf einen Tag → weich zur Tagesgruppe darunter springen.
 *   2. Tipp auf DENSELBEN Tag → das Anlege-Blatt öffnet sich, Tag vorbelegt.
 *
 * Ein leerer Tag hat nichts, wohin man springen könnte — dort öffnet der
 * erste Tipp gleich das Blatt. Anlegen ist das Einzige, was man mit einem
 * leeren Tag tun kann.
 */

export type RasterEvent = { key: string; title: string; dotColor: string };
export type RasterZelle = { key: string; day: number; inMonth: boolean };

export function MonatsRaster({
  weeks,
  eventsByDay,
  todayKey,
  kurz,
}: {
  weeks: RasterZelle[][];
  eventsByDay: Record<string, RasterEvent[]>;
  todayKey: string;
  /** Kurzform der Termintitel, serverseitig gerechnet. */
  kurz: Record<string, string>;
}) {
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [blattTag, setBlattTag] = useState<string | null>(null);

  function springeZu(key: string) {
    const el = document.getElementById(key);
    if (!el) return false;
    const scroller = el.closest(".overflow-y-auto") as HTMLElement | null;
    const kopf = document.querySelector("[data-monatskopf]") as HTMLElement | null;
    const offset = (kopf?.offsetHeight ?? 0) + 12;
    if (scroller) {
      const y =
        el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - offset;
      scroller.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      return true;
    }
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }

  function tipp(zelle: RasterZelle) {
    if (!zelle.inMonth) return;
    const hatTermine = (eventsByDay[zelle.key] ?? []).length > 0;
    if (auswahl === zelle.key || !hatTermine) {
      setBlattTag(zelle.key);
      return;
    }
    setAuswahl(zelle.key);
    springeZu(zelle.key);
  }

  return (
    <>
      <div className="mt-4 overflow-hidden rounded-card bg-surface shadow-card">
        <div className="grid grid-cols-7 border-b border-surface-muted/60 text-center">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => (
            <span key={w} className="py-1.5 text-[10px] font-medium text-ink-muted">
              {w}
            </span>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-surface-muted/40 last:border-0">
            {week.map((cell) => {
              const events = cell.inMonth ? (eventsByDay[cell.key] ?? []) : [];
              const isToday = cell.key === todayKey;
              const shown = events.slice(0, 3);
              const more = events.length - shown.length;
              return (
                <button
                  key={cell.key}
                  onClick={() => tipp(cell)}
                  disabled={!cell.inMonth}
                  aria-label={cell.inMonth ? `Tag ${cell.day}` : undefined}
                  className={`min-w-0 border-r border-surface-muted/40 text-left last:border-r-0 ${
                    auswahl === cell.key ? "bg-accent-light/40" : ""
                  }`}
                >
                  <div
                    className={`flex min-h-[68px] flex-col gap-0.5 px-0.5 pb-1 pt-0.5 ${
                      cell.inMonth ? "" : "opacity-30"
                    } ${isToday ? "bg-accent-light/60" : ""}`}
                  >
                    <span
                      className={`tnum self-end px-0.5 text-[10px] leading-tight ${
                        isToday
                          ? "flex h-4 w-4 items-center justify-center self-end rounded-full bg-accent font-semibold text-surface"
                          : "text-ink-muted"
                      }`}
                    >
                      {cell.day}
                    </span>
                    {shown.map((ev) => (
                      <span
                        key={ev.key}
                        className="block truncate rounded-[3px] pl-0.5 text-left text-[8px] font-medium leading-[1.35] text-ink"
                        style={{ borderLeft: `2px solid ${ev.dotColor}`, background: "var(--color-bg)" }}
                      >
                        {kurz[ev.key] ?? ev.title}
                      </span>
                    ))}
                    {more > 0 && (
                      <span className="pl-1 text-left text-[8px] leading-none text-ink-muted">+{more}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {blattTag && <NeuerTerminBlatt tag={blattTag} onClose={() => setBlattTag(null)} />}
      </AnimatePresence>
    </>
  );
}

const tagFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Berlin",
});

/** Das Anlege-Blatt: Titel, Zeit, fertig — der Tag ist schon gewählt. */
function NeuerTerminBlatt({ tag, onClose }: { tag: string; onClose: () => void }) {
  const [titel, setTitel] = useState("");
  const [von, setVon] = useState("09:00");
  const [bis, setBis] = useState("10:00");
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function anlegen() {
    if (!titel.trim() || pending) return;
    start(async () => {
      const r = await neuerTerminAction({ titel, tag, von, bis });
      if (r.ok) {
        onClose();
        router.refresh();
      } else {
        setFehler(r.grund ?? "Hat nicht geklappt.");
      }
    });
  }

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
        <p className="text-sm text-ink-muted">Neuer Termin am</p>
        <h2 className="font-display text-2xl">{tagFmt.format(new Date(`${tag}T12:00:00Z`))}</h2>
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
        <button
          onClick={anlegen}
          disabled={pending || !titel.trim()}
          className="mt-4 w-full rounded-pill bg-accent px-5 py-3.5 font-medium text-surface disabled:opacity-50"
        >
          {pending ? "Lege an …" : "In den Kalender"}
        </button>
        {fehler && <p className="mt-2 text-sm text-signal">{fehler}</p>}
      </motion.div>
    </div>
  );
}
