"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

/* ------------------------------------------------------------------ */
/*  Interne Design-Referenz. Nicht Teil der eigentlichen App-Screens. */
/*  Zeigt Tokens, Typo, Komponenten, Motion und den Font-Switcher.    */
/* ------------------------------------------------------------------ */

const COLORS = [
  { name: "bg", label: "Untergrund", oklch: "95.43% .0136 78" },
  { name: "surface", label: "Fläche erhöht", oklch: "97.76% .009 78" },
  { name: "surface-muted", label: "Fläche gedämpft", oklch: "90.86% .0223 74" },
  { name: "ink", label: "Tinte", oklch: "23.49% .0447 260" },
  { name: "ink-muted", label: "Tinte gedämpft", oklch: "46.5% .045 261" },
  { name: "accent", label: "Akzent Türkis", oklch: "64.91% .1136 182" },
  { name: "accent-light", label: "Akzent hell", oklch: "83.29% .0917 185" },
  { name: "counter", label: "Warmer Kontrapunkt", oklch: "68.52% .0668 24" },
  { name: "counter-light", label: "Kontrapunkt hell", oklch: "87.41% .0287 29" },
  { name: "signal", label: "Signal", oklch: "54.78% .1426 31" },
];

const FONT_PAIRINGS = [
  {
    id: "fraunces-geist",
    label: "Fraunces + Geist",
    note: "Gewählt ✓ · warm trifft modern, beide selbst gehostet",
    display: "var(--font-fraunces)",
    body: "var(--font-geist)",
  },
  {
    id: "instrument-geist",
    label: "Instrument Serif + Geist",
    note: "Kühler, redaktionell",
    display: "var(--font-instrument)",
    body: "var(--font-geist)",
  },
  {
    id: "fraunces-hanken",
    label: "Fraunces + Hanken Grotesk",
    note: "Rundere Sans zum Vergleich",
    display: "var(--font-fraunces)",
    body: "var(--font-hanken)",
  },
] as const;

export default function StylePage() {
  const [pairing, setPairing] = useState<(typeof FONT_PAIRINGS)[number]>(FONT_PAIRINGS[0]);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    return () => document.documentElement.removeAttribute("data-theme");
  }, [dark]);

  const fontVars = {
    "--font-display": pairing.display,
    "--font-body": pairing.body,
  } as CSSProperties;

  return (
    <div style={fontVars} className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-md px-5 pb-24 pt-8">
        {/* Kopf */}
        <p className="eyebrow text-ink-muted">Interne Referenz</p>
        <h1 className="mt-1 text-4xl">Style</h1>
        <p className="mt-2 text-ink-muted">
          Die Bausteine, bevor die Screens kommen. Vergleich am Handy: Fonts und Theme wechseln.
        </p>

        {/* Font-Switcher */}
        <Section title="Schrift">
          <div className="flex flex-col gap-2">
            {FONT_PAIRINGS.map((p) => {
              const active = p.id === pairing.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPairing(p)}
                  className={`rounded-card border px-4 py-3 text-left transition-colors duration-150 ease-out ${
                    active
                      ? "border-transparent bg-ink text-surface"
                      : "border-surface-muted bg-surface text-ink"
                  }`}
                >
                  <span
                    className="block text-lg"
                    style={{ fontFamily: p.display }}
                  >
                    {p.label}
                  </span>
                  <span
                    className={`text-xs ${active ? "text-surface/70" : "text-ink-muted"}`}
                  >
                    {p.note}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-card bg-surface px-4 py-3 shadow-card">
            <span className="text-sm">Dark Mode (Mitternachtsblau)</span>
            <ThemeToggle dark={dark} onToggle={() => setDark((d) => !d)} />
          </div>
        </Section>

        {/* Farben */}
        <Section title="Farbwelt">
          <div className="grid grid-cols-2 gap-3">
            {COLORS.map((c) => (
              <div key={c.name} className="overflow-hidden rounded-card shadow-card">
                <div
                  className="h-14 w-full"
                  style={{ background: `var(--color-${c.name})` }}
                />
                <div className="bg-surface px-3 py-2">
                  <div className="text-sm font-medium">{c.label}</div>
                  <div className="tnum text-[11px] text-ink-muted">
                    oklch({c.oklch})
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Türkis nur an wenigen Stellen pro Screen. Rosé fürs Warme, Signal nur für Überfälliges.
          </p>
        </Section>

        {/* Typografie */}
        <Section title="Typografie">
          <div className="rounded-card bg-surface p-5 shadow-card">
            <p className="eyebrow text-ink-muted">Montag, 27. Juli</p>
            <p className="mt-1 font-display text-4xl">Guten Morgen, Dirk</p>
            <p className="tnum mt-4 font-display text-6xl leading-none">10:15</p>
            <p className="mt-4 text-base">
              Body-Text in {pairing.id === "instrument-geist" || pairing.id === "fraunces-geist" ? "Geist" : "Hanken Grotesk"}.
              Warm, ruhig, gut lesbar — auch nachts mit einer Hand.
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Sekundärtext in gedämpfter Tinte. Max. drei Textgrößen pro Screen.
            </p>
          </div>
        </Section>

        {/* Braucht deine Antwort — Kernkomponente */}
        <Section title="Braucht deine Antwort">
          <RequestCard />
        </Section>

        {/* Termin-Karten */}
        <Section title="Termin-Karten">
          <div className="flex flex-col gap-3">
            <EventCard time="9:00" title="Physio" people={["dirk"]} badge={<Badge tone="geklaert">☺ Betreuung geklärt</Badge>} />
            <EventCard time="16:30" title="Einkauf" people={["constanze"]} badge={<Badge tone="offen">☹ Betreuung offen</Badge>} />
            <EventCard time="10:15" title="Kinderarzt · U3" people={["constanze", "dirk"]} badge={<Badge tone="geklaert">☺ Betreuung geklärt</Badge>} />
          </div>
        </Section>

        {/* Buttons */}
        <Section title="Buttons">
          <div className="flex flex-col gap-3">
            <TapButton className="bg-accent text-surface">Ja, mache ich</TapButton>
            <TapButton className="bg-surface-muted text-ink">Geht nicht</TapButton>
            <TapButton className="border border-ink/15 bg-transparent text-ink">Anpassen</TapButton>
          </div>
        </Section>

        {/* Einkaufsliste mit Belohnungsmoment */}
        <Section title="Einkaufsliste">
          <ShoppingDemo />
        </Section>

        {/* Motion-Demo: Sheet */}
        <Section title="Motion — Sheet (Spring)">
          <SheetDemo />
        </Section>
      </div>

      {/* Tab-Bar */}
      <TabBar />
    </div>
  );
}

/* ----------------------------- Bausteine ----------------------------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 flex items-center gap-3 text-xl">
        <span>{title}</span>
        <span className="h-px flex-1 bg-surface-muted" />
      </h2>
      {children}
    </section>
  );
}

function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="relative h-7 w-12 rounded-pill bg-surface-muted"
      aria-pressed={dark}
      aria-label="Dark Mode umschalten"
    >
      <motion.span
        className="absolute top-0.5 h-6 w-6 rounded-full bg-accent"
        animate={{ left: dark ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
      />
    </button>
  );
}

function RequestCard() {
  const [answered, setAnswered] = useState<null | "ja" | "nein">(null);
  return (
    <div className="rounded-card bg-ink p-5 text-surface shadow-hero">
      <div className="flex items-center justify-between">
        <p className="eyebrow text-accent-light">Braucht deine Antwort</p>
        <span className="h-2 w-2 rounded-full bg-counter" />
      </div>
      <p className="mt-3 font-display text-2xl">Schaffst du Donnerstag den Einkauf?</p>
      <p className="mt-3 flex items-center gap-2 text-sm text-surface/70">
        <Avatar person="constanze" size={22} /> Constanze fragt · vor 20 Min.
      </p>
      <AnimatePresence mode="wait">
        {answered ? (
          <motion.p
            key="done"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="mt-5 rounded-card bg-surface/10 px-4 py-3 text-accent-light"
          >
            {answered === "ja" ? "Erledigt — Constanze weiß Bescheid." : "Alles gut, sie plant um."}
          </motion.p>
        ) : (
          <motion.div key="buttons" exit={{ opacity: 0 }} className="mt-5 grid grid-cols-2 gap-3">
            <TapButton className="bg-accent text-surface" onClick={() => setAnswered("ja")}>
              Ja, mache ich
            </TapButton>
            <TapButton className="bg-white/10 text-surface" onClick={() => setAnswered("nein")}>
              Geht nicht
            </TapButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EventCard({
  time,
  title,
  people,
  badge,
}: {
  time: string;
  title: string;
  people: ("dirk" | "constanze")[];
  badge: React.ReactNode;
}) {
  return (
    <div className="flex items-stretch gap-4 rounded-card bg-surface p-4 shadow-card">
      <div className="tnum flex w-14 shrink-0 items-center font-display text-lg">{time}</div>
      <div className="w-px bg-surface-muted" />
      <div className="min-w-0 flex-1">
        <div className="text-lg font-semibold">{title}</div>
        <div className="mt-2 flex items-center gap-2">
          <span className="flex -space-x-1.5">
            {people.map((p) => (
              <Avatar key={p} person={p} size={22} />
            ))}
          </span>
          {badge}
        </div>
      </div>
    </div>
  );
}

function TapButton({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className={`rounded-pill px-5 py-3.5 text-center font-medium ${className}`}
    >
      {children}
    </motion.button>
  );
}

function ShoppingDemo() {
  const [items, setItems] = useState([
    { text: "Bananen", by: "dirk" as const, done: true, group: "Frisches" },
    { text: "Haferdrink", by: "dirk" as const, done: true, group: "Frisches" },
    { text: "Windeln Größe 2", by: "constanze" as const, done: false, group: "Baby" },
    { text: "Spülmaschinentabs", by: "dirk" as const, done: false, group: "Haushalt" },
  ]);
  const allDone = items.every((i) => i.done);

  return (
    <div className="relative rounded-card bg-surface p-4 shadow-card">
      {items.map((item, i) => (
        <button
          key={item.text}
          onClick={() =>
            setItems((prev) => prev.map((it, j) => (j === i ? { ...it, done: !it.done } : it)))
          }
          className="flex w-full items-center gap-3 border-b border-surface-muted/60 py-3 last:border-0"
        >
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150 ${
              item.done ? "border-accent bg-accent text-surface" : "border-ink-muted/40"
            }`}
          >
            {item.done && <CheckIcon />}
          </span>
          <span className={item.done ? "text-ink-muted line-through" : "font-medium"}>
            {item.text}
          </span>
          <span className="ml-auto">
            <Avatar person={item.by} size={18} />
          </span>
        </button>
      ))}
      <AnimatePresence>
        {allDone && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="mt-3 rounded-pill bg-accent-light px-4 py-2 text-center text-sm font-medium text-ink"
          >
            Alles erledigt ✓
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TapButton className="bg-surface text-ink shadow-card" onClick={() => setOpen(true)}>
        Sheet öffnen
      </TapButton>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-ink/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-surface p-6 pb-10 shadow-hero"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 38 }}
            >
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-surface-muted" />
              <p className="font-display text-2xl">Nur dieser Termin?</p>
              <p className="mt-2 text-ink-muted">
                Serien-Bearbeitung: nur dieser Termin oder die ganze Serie.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <TapButton className="bg-accent text-surface" onClick={() => setOpen(false)}>
                  Nur dieser
                </TapButton>
                <TapButton className="bg-surface-muted text-ink" onClick={() => setOpen(false)}>
                  Ganze Serie
                </TapButton>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TabBar() {
  const tabs = ["Woche", "Termine", "Einkauf", "Ideen"];
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-surface-muted bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-around px-4 py-2.5">
        {tabs.map((t, i) => (
          <div
            key={t}
            className={`flex flex-col items-center gap-1 text-xs ${
              i === 0 ? "text-accent" : "text-ink-muted"
            }`}
          >
            <span className="h-5 w-5 rounded-md border-2 border-current" />
            {t}
          </div>
        ))}
      </div>
    </nav>
  );
}
