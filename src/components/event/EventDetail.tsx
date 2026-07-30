"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  saveNotes,
  takeCareAction,
  requestCareAction,
  dismissCareAction,
  deleteEventAction,
  updateEventAction,
  savePrep,
  suggestPrepAction,
  linkShoppingItemAction,
  unlinkShoppingItemAction,
  addShoppingItemToEventAction,
  toggleShoppingItemAction,
  type PrepItem,
} from "@/app/termin/[uid]/actions";
import { Avatar } from "@/components/ui/Avatar";
import type { DetailVM } from "@/lib/calendar/view-model";

export type EventShoppingData = {
  linked: { id: string; text: string; checked: boolean }[];
  linkable: { id: string; text: string }[];
};

export function EventDetail({ vm, shopping }: { vm: DetailVM; shopping?: EventShoppingData | null }) {
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

        <PrepChecklist
          uid={vm.uid}
          initial={vm.prep}
          title={vm.title}
          category={vm.categoryLabel}
          readOnly={vm.readOnly}
        />

        {shopping && <EventShopping uid={vm.uid} data={shopping} readOnly={vm.readOnly} />}

        <NotesEditor uid={vm.uid} initial={vm.notes} readOnly={vm.readOnly} />

        {!vm.readOnly && <ManageBlock vm={vm} />}
      </div>
    </div>
  );
}

/** Bearbeiten (Titel/Zeit → iCloud) und Löschen (auch in iCloud). */
function ManageBlock({ vm }: { vm: DetailVM }) {
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"idle" | "edit" | "confirmDelete">("idle");
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(vm.title);
  const initialDate = vm.occurrenceISO
    ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date(vm.occurrenceISO))
    : "";
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(vm.timeLabel);
  const [endTime, setEndTime] = useState(vm.endLabel);

  function save() {
    setError(null);
    start(async () => {
      const payload: { title: string; startISO?: string; endISO?: string } = { title };
      if (!vm.allDay && date && startTime && endTime) {
        // Browser der beiden läuft in Berliner Zeit → lokale Konstruktion ist korrekt.
        payload.startISO = new Date(`${date}T${startTime}:00`).toISOString();
        payload.endISO = new Date(`${date}T${endTime}:00`).toISOString();
      }
      const r = await updateEventAction(vm.uid, payload);
      if (r.ok) setMode("idle");
      else setError(r.reason ?? "Ändern fehlgeschlagen.");
    });
  }
  function doDelete() {
    setError(null);
    start(async () => {
      const r = await deleteEventAction(vm.uid);
      if (r && !r.ok) setError(r.reason ?? "Löschen fehlgeschlagen.");
    });
  }

  return (
    <section className="mt-6">
      {mode === "edit" ? (
        <div className="rounded-card bg-surface p-5 shadow-card">
          <h2 className="mb-3 font-display text-lg">Termin bearbeiten</h2>
          <div className="flex flex-col gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent"
            />
            {!vm.allDay && (
              <>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="block w-full min-w-0 appearance-none rounded-card border border-surface-muted bg-bg px-4 py-2.5 text-base outline-none focus:border-accent" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                    className="block w-full min-w-0 appearance-none rounded-card border border-surface-muted bg-bg px-3 py-2.5 text-base outline-none focus:border-accent" />
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                    className="block w-full min-w-0 appearance-none rounded-card border border-surface-muted bg-bg px-3 py-2.5 text-base outline-none focus:border-accent" />
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={save} disabled={pending}
                className="rounded-pill bg-accent px-4 py-3 font-medium text-surface disabled:opacity-60">
                {pending ? "Speichere …" : "Speichern"}
              </button>
              <button onClick={() => setMode("idle")} className="rounded-pill bg-surface-muted px-4 py-3 font-medium text-ink">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-6">
          {!vm.isSeries && (
            <button onClick={() => setMode("edit")} className="text-sm font-medium text-ink-muted">
              Bearbeiten
            </button>
          )}
          {mode === "confirmDelete" ? (
            <button onClick={doDelete} disabled={pending} className="text-sm font-semibold text-signal">
              {pending ? "Lösche …" : vm.isSeries ? "Wirklich ganze Serie löschen?" : "Wirklich löschen?"}
            </button>
          ) : (
            <button onClick={() => setMode("confirmDelete")} className="text-sm text-ink-muted/70">
              {vm.isSeries ? "Serie löschen" : "Löschen"}
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-center text-sm text-signal">{error}</p>}
    </section>
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

      {care?.status === "keine" ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-muted">Keine Betreuung nötig.</p>
          {canAct && (
            <button
              disabled={pending}
              onClick={() =>
                start(() => requestCareAction(vm.uid, vm.occurrenceISO!, vm.title).then(() => {}))
              }
              className="text-sm font-medium text-accent"
            >
              Doch klären
            </button>
          )}
        </div>
      ) : geklaert ? (
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
              <button
                disabled={pending}
                onClick={() =>
                  start(() => dismissCareAction(vm.uid, vm.occurrenceISO!).then(() => {}))
                }
                className="text-sm text-ink-muted/70"
              >
                Braucht keine Betreuung
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

function PrepChecklist({
  uid,
  initial,
  title,
  category,
  readOnly,
}: {
  uid: string;
  initial: PrepItem[];
  title: string;
  category: string;
  readOnly?: boolean;
}) {
  const [items, setItems] = useState<PrepItem[]>(initial);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function persist(next: PrepItem[]) {
    setItems(next);
    if (!readOnly) void savePrep(uid, next);
  }
  function toggle(i: number) {
    if (readOnly) return;
    persist(items.map((p, idx) => (idx === i ? { ...p, done: !p.done } : p)));
  }
  function remove(i: number) {
    if (readOnly) return;
    persist(items.filter((_, idx) => idx !== i));
  }
  function add(text: string) {
    const t = text.trim();
    if (!t || readOnly) return;
    if (items.some((p) => p.text.toLowerCase() === t.toLowerCase())) return;
    persist([...items, { text: t, done: false }]);
  }
  function suggest() {
    setError(null);
    start(async () => {
      const res = await suggestPrepAction(title, category);
      if (res.ok) setSuggestions(res.items.filter((s) => !items.some((p) => p.text.toLowerCase() === s.toLowerCase())));
      else setError(res.error);
    });
  }

  const done = items.filter((p) => p.done).length;

  return (
    <section className="mt-4 rounded-card bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg">Vorbereitung</h2>
        {items.length > 0 && <span className="tnum text-ink-muted">{done} / {items.length}</span>}
      </div>

      <ul className="flex flex-col gap-1">
        {items.map((p, i) => (
          <li key={i} className="group flex items-center gap-3 py-1.5">
            <button
              onClick={() => toggle(i)}
              disabled={readOnly}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                p.done ? "border-accent bg-accent text-surface" : "border-ink-muted/40"
              }`}
              aria-label={p.done ? "Erledigt" : "Offen"}
            >
              {p.done && <Check />}
            </button>
            <span className={`flex-1 ${p.done ? "text-ink-muted line-through" : ""}`}>{p.text}</span>
            {!readOnly && (
              <button onClick={() => remove(i)} className="text-sm text-ink-muted/50" aria-label="Entfernen">✕</button>
            )}
          </li>
        ))}
      </ul>

      {items.length === 0 && (
        <p className="text-sm text-ink-muted">Noch nichts — füg etwas hinzu oder frag die KI.</p>
      )}

      {!readOnly && (
        <>
          <form
            onSubmit={(e) => { e.preventDefault(); add(draft); setDraft(""); }}
            className="mt-3 flex gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Punkt hinzufügen"
              className="flex-1 rounded-pill border border-surface-muted bg-bg px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
            <button type="submit" className="rounded-pill bg-surface-muted px-4 py-2.5 text-sm font-medium text-ink">
              Hinzufügen
            </button>
          </form>

          <button
            onClick={suggest}
            disabled={pending}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-signal disabled:opacity-60"
          >
            <Sparkle /> {pending ? "Denke nach …" : "KI-Vorschläge"}
          </button>
          {error && <p className="mt-1 text-sm text-signal">{error}</p>}

          <AnimatePresence>
            {suggestions && suggestions.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => { add(s); setSuggestions((prev) => prev?.filter((x) => x !== s) ?? null); }}
                    className="inline-flex items-center gap-1 rounded-pill bg-counter-light px-3 py-1.5 text-sm text-ink"
                  >
                    <span className="text-signal">+</span> {s}
                  </button>
                ))}
              </motion.div>
            )}
            {suggestions && suggestions.length === 0 && (
              <p className="mt-2 text-sm text-ink-muted">Alles schon auf der Liste.</p>
            )}
          </AnimatePresence>
        </>
      )}
    </section>
  );
}

function Sparkle() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z" />
    </svg>
  );
}

function EventShopping({
  uid,
  data,
  readOnly,
}: {
  uid: string;
  data: EventShoppingData;
  readOnly?: boolean;
}) {
  const [linked, setLinked] = useState(data.linked);
  const [linkable, setLinkable] = useState(data.linkable);
  const [check, setCheck] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [, start] = useTransition();

  const isChecked = (id: string, fallback: boolean) => check[id] ?? fallback;

  function toggle(id: string, current: boolean) {
    if (readOnly) return;
    setCheck((c) => ({ ...c, [id]: !isChecked(id, current) }));
    start(() => { void toggleShoppingItemAction(uid, id); });
  }
  function link(item: { id: string; text: string }) {
    if (readOnly) return;
    setLinkable((l) => l.filter((x) => x.id !== item.id));
    setLinked((l) => [...l, { ...item, checked: false }]);
    start(() => { void linkShoppingItemAction(uid, item.id); });
  }
  function unlink(id: string) {
    if (readOnly) return;
    const item = linked.find((x) => x.id === id);
    setLinked((l) => l.filter((x) => x.id !== id));
    if (item && !isChecked(id, item.checked)) setLinkable((l) => [...l, { id, text: item.text }]);
    start(() => { void unlinkShoppingItemAction(uid, id); });
  }
  function add(e: React.FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if (!t || readOnly) return;
    setDraft("");
    const tempId = `tmp-${t}`;
    setLinked((l) => [...l, { id: tempId, text: t, checked: false }]);
    start(() => { void addShoppingItemToEventAction(uid, t); });
  }

  const openCount = linked.filter((it) => !isChecked(it.id, it.checked)).length;

  return (
    <section className="mt-4 rounded-card bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg">
          <BasketIcon /> Einkauf für diesen Termin
        </h2>
        {linked.length > 0 && <span className="tnum text-ink-muted">{openCount} offen</span>}
      </div>

      {linked.length === 0 && <p className="text-sm text-ink-muted">Zieh Dinge aus der Liste hierher oder trag etwas ein.</p>}

      <ul className="flex flex-col gap-1">
        {linked.map((it) => {
          const done = isChecked(it.id, it.checked);
          return (
            <li key={it.id} className="flex items-center gap-3 py-1.5">
              <button
                onClick={() => toggle(it.id, it.checked)}
                disabled={readOnly}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                  done ? "border-accent bg-accent text-surface" : "border-ink-muted/40"
                }`}
                aria-label={done ? "Erledigt" : "Offen"}
              >
                {done && <Check />}
              </button>
              <span className={`flex-1 ${done ? "text-ink-muted line-through" : ""}`}>{it.text}</span>
              {!readOnly && (
                <button onClick={() => unlink(it.id)} className="text-sm text-ink-muted/50" aria-label="Vom Termin lösen">✕</button>
              )}
            </li>
          );
        })}
      </ul>

      {!readOnly && (
        <>
          <form onSubmit={add} className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Etwas hinzufügen"
              className="flex-1 rounded-pill border border-surface-muted bg-bg px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
            <button type="submit" className="rounded-pill bg-surface-muted px-4 py-2.5 text-sm font-medium text-ink">
              Hinzufügen
            </button>
          </form>

          {linkable.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowPicker((s) => !s)}
                className="text-sm font-medium text-accent"
              >
                {showPicker ? "Fertig" : `Aus der Liste ziehen (${linkable.length})`}
              </button>
              <AnimatePresence>
                {showPicker && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 flex flex-wrap gap-1.5">
                    {linkable.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => link(item)}
                        className="inline-flex items-center gap-1 rounded-pill bg-accent-light px-3 py-1.5 text-sm text-ink"
                      >
                        <span className="text-accent">+</span> {item.text}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function BasketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 8h14l-1.2 10.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8.5 8l3.5-4 3.5 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
