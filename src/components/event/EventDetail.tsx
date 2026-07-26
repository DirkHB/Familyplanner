"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { saveNotes, takeCareAction, requestCareAction } from "@/app/termin/[uid]/actions";
import { Avatar } from "@/components/ui/Avatar";
import type { DetailVM } from "@/lib/calendar/view-model";

export function EventDetail({ vm }: { vm: DetailVM }) {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-md px-5 pb-28 pt-6">
        <header className="mb-5 flex items-center justify-between">
          <Link
            href="/woche"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-card"
            aria-label="Zurück"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <span className="eyebrow text-ink-muted">{vm.categoryLabel}</span>
          <span className="w-10" />
        </header>

        {/* Hero — dunkelblauer Anker */}
        <div className="rounded-card bg-ink p-6 text-surface shadow-hero">
          <p className="eyebrow text-accent-light">{vm.dateLabel}</p>
          <h1 className="mt-2 font-display text-3xl leading-tight">{vm.title}</h1>
          <div className="mt-4 flex items-end gap-5">
            <p className="tnum font-display text-5xl leading-none">
              {vm.allDay ? "ganztägig" : vm.timeLabel}
            </p>
            {vm.location && (
              <div className="min-w-0 flex-1 border-l border-white/15 pl-4 pb-1">
                <p className="flex items-center gap-1.5 font-medium">
                  <PinIcon /> {vm.location}
                </p>
              </div>
            )}
          </div>
        </div>

        {!vm.allDay && <CareBlock vm={vm} />}

        {vm.prep.length > 0 && (
          <Section title="Vorbereitung" trailing={`${vm.prep.filter((p) => p.done).length} / ${vm.prep.length}`}>
            <ul className="flex flex-col gap-1">
              {vm.prep.map((p, i) => (
                <li key={i} className="flex items-center gap-3 py-1.5">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                      p.done ? "border-accent bg-accent text-surface" : "border-ink-muted/40"
                    }`}
                  >
                    {p.done && <Check />}
                  </span>
                  <span className={p.done ? "text-ink-muted line-through" : ""}>{p.text}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <NotesEditor uid={vm.uid} initial={vm.notes} readOnly={vm.readOnly} />
      </div>
    </div>
  );
}

function CareBlock({ vm }: { vm: DetailVM }) {
  const [pending, start] = useTransition();
  const care = vm.care;
  const canAct = !vm.readOnly && !!vm.occurrenceISO;

  const geklaert = care?.status === "geklaert" && care.responsiblePerson;

  return (
    <section className="mt-4 rounded-card bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg">Wer ist beim Baby</h2>
        {vm.timeLabel && vm.endLabel && (
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-accent-light px-2.5 py-1 text-xs font-medium text-ink">
            <ClockIcon /> {vm.timeLabel}–{vm.endLabel}
          </span>
        )}
      </div>

      {geklaert ? (
        <div className="flex items-center gap-3">
          <Avatar person={care!.responsiblePerson!} size={40} />
          <div>
            <p className="font-semibold">{care!.responsibleName} ist da</p>
            <p className="text-sm text-ink-muted">Betreuung geklärt</p>
          </div>
        </div>
      ) : (
        <div>
          <p className="mb-3 text-sm text-ink-muted">
            {care?.status === "offen"
              ? "Noch offen — eine Anfrage ist unterwegs."
              : "Noch nicht geklärt."}
          </p>
          {canAct && (
            <div className="flex flex-col gap-2">
              <button
                disabled={pending}
                onClick={() => start(() => takeCareAction(vm.uid, vm.occurrenceISO!).then(() => {}))}
                className="rounded-pill bg-accent px-5 py-3 font-medium text-surface disabled:opacity-60"
              >
                Ich mache es
              </button>
              <button
                disabled={pending}
                onClick={() =>
                  start(() => requestCareAction(vm.uid, vm.occurrenceISO!, vm.title).then(() => {}))
                }
                className="rounded-pill bg-surface-muted px-5 py-3 font-medium text-ink disabled:opacity-60"
              >
                Den anderen fragen
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v4.5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NotesEditor({
  uid,
  initial,
  readOnly,
}: {
  uid: string;
  initial: string;
  readOnly?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState<"idle" | "saving" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(v: string) {
    setValue(v);
    if (readOnly) return;
    setSaved("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await saveNotes(uid, v);
      setSaved("done");
      setTimeout(() => setSaved("idle"), 1500);
    }, 700);
  }

  return (
    <section className="mt-4 rounded-card p-5" style={{ background: "var(--color-counter-light)" }}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg text-signal">
          <PencilIcon /> Notizen
        </h2>
        <motion.span
          key={saved}
          initial={{ opacity: 0 }}
          animate={{ opacity: saved === "idle" ? 0 : 1 }}
          className="text-xs text-ink-muted"
        >
          {saved === "saving" ? "sichern …" : saved === "done" ? "gesichert ✓" : ""}
        </motion.span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        placeholder="Was ist wichtig für diesen Termin?"
        rows={3}
        className="w-full resize-none bg-transparent text-ink outline-none placeholder:text-ink-muted/70"
      />
    </section>
  );
}

function Section({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 rounded-card bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg">{title}</h2>
        {trailing && <span className="tnum text-ink-muted">{trailing}</span>}
      </div>
      {children}
    </section>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" stroke="var(--color-accent)" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="2.4" stroke="var(--color-accent)" strokeWidth="1.8" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 20h4L18.5 9.5a2 2 0 0 0-2.8-2.8L5 17.2 4 20Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
