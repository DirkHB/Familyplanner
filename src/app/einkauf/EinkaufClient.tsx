"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Avatar } from "@/components/ui/Avatar";
import { SwipeRow } from "@/components/ui/SwipeRow";
import { AppShell } from "@/components/app/AppShell";
import { PLATZ_A, PLATZ_B, type Platz as Person } from "@/lib/haushalt/platz";
import { OHNE_LADEN } from "@/lib/shopping/stores";
import { FabKnopf } from "@/components/app/FabErfassen";
import { ErfassenSheet } from "./ErfassenSheet";
import { NeuesFachChip } from "@/components/ui/NeuesFachChip";
import { createStoreAction } from "@/app/einstellungen/actions";

import {
  addItemAction,
  toggleItemAction,
  deleteItemAction,
  moveItemAction,
  clearCheckedAction,
} from "./actions";
import {
  localQueueStore,
  loadQueue,
  enqueue,
  saveQueue,
  collapseOps,
  type QueuedOp,
} from "@/lib/offline/queue";

type Item = { id: string; text: string; checked: boolean; addedByPerson: Person | null };
type Group = { category: string; label: string; items: Item[] };

const isOffline = () => typeof navigator !== "undefined" && !navigator.onLine;

type Drag = { id: string; text: string; x: number; y: number; from: string };

export function EinkaufClient({
  groups,
  partnerName,
  suggestions = [],
}: {
  groups: Group[];
  partnerName: string;
  partnerPerson?: Person;
  suggestions?: string[];
}) {
  const [usedSuggestions, setUsedSuggestions] = useState<string[]>([]);
  const router = useRouter();
  const [, start] = useTransition();
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const [removed, setRemoved] = useState<Record<string, boolean>>({});
  const [storeOverride, setStoreOverride] = useState<Record<string, string>>({});
  const [pendingAdds, setPendingAdds] = useState<string[]>([]);
  const [queued, setQueued] = useState(0);
  const [online, setOnline] = useState(true);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [erfassen, setErfassen] = useState(false);
  const [hoverStore, setHoverStore] = useState<string | null>(null);
  const sectionEls = useRef(new Map<string, HTMLElement>());

  const isChecked = (it: Item) => override[it.id] ?? it.checked;

  // Sektionen client-seitig aufbauen: Laden-Override (Drag) + Abgehakte nach unten.
  const sections = groups.map((g) => {
    const items = groups
      .flatMap((gr) => gr.items.map((it) => ({ ...it, base: gr.category })))
      .filter((it) => !removed[it.id] && (storeOverride[it.id] ?? it.base) === g.category);
    const open = items.filter((it) => !isChecked(it));
    const done = items.filter((it) => isChecked(it));
    return { store: g.category, label: g.label, open, done };
  });

  const all = sections.flatMap((s) => [...s.open, ...s.done]);
  const openCount = sections.reduce((n, s) => n + s.open.length, 0);
  const doneCount = sections.reduce((n, s) => n + s.done.length, 0);
  const allDone = all.length > 0 && openCount === 0;

  /* ------------------------- Offline-Queue (wie gehabt) ------------------------- */
  useEffect(() => {
    setOnline(!isOffline());
    setQueued(loadQueue(localQueueStore).length);
    const onOnline = () => { setOnline(true); void flushQueue(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    void flushQueue();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyOp(op: QueuedOp) {
    if (op.kind === "toggle") await toggleItemAction(op.id);
    else if (op.kind === "add") await addItemAction(op.text);
    else if (op.kind === "delete") await deleteItemAction(op.id);
  }

  async function flushQueue() {
    if (isOffline()) { setQueued(loadQueue(localQueueStore).length); return; }
    let remaining = collapseOps(loadQueue(localQueueStore));
    saveQueue(localQueueStore, remaining);
    while (remaining.length) {
      try { await applyOp(remaining[0]); } catch { break; }
      remaining = remaining.slice(1);
      saveQueue(localQueueStore, remaining);
      setQueued(remaining.length);
    }
    setQueued(remaining.length);
    if (remaining.length === 0) { setPendingAdds([]); router.refresh(); }
  }

  function toggle(it: Item) {
    setOverride((o) => ({ ...o, [it.id]: !isChecked(it) }));
    const op: QueuedOp = { kind: "toggle", id: it.id, ts: Date.now() };
    start(async () => {
      if (isOffline()) { enqueue(localQueueStore, op); setQueued((n) => n + 1); return; }
      try { await toggleItemAction(it.id); }
      catch { enqueue(localQueueStore, op); setQueued((n) => n + 1); }
    });
  }
  function addText(t: string, store?: string) {
    if (!t) return;
    const op: QueuedOp = { kind: "add", text: t, ts: Date.now() };
    start(async () => {
      if (isOffline()) { enqueue(localQueueStore, op); setPendingAdds((p) => [...p, t]); setQueued((n) => n + 1); return; }
      try { await addItemAction(t, store); router.refresh(); }
      catch { enqueue(localQueueStore, op); setPendingAdds((p) => [...p, t]); setQueued((n) => n + 1); }
    });
  }
  function addSuggestion(t: string) {
    setUsedSuggestions((u) => [...u, t]);
    addText(t);
  }
  function remove(it: Item) {
    setRemoved((r) => ({ ...r, [it.id]: true }));
    const op: QueuedOp = { kind: "delete", id: it.id, ts: Date.now() };
    start(async () => {
      if (isOffline()) { enqueue(localQueueStore, op); setQueued((n) => n + 1); return; }
      try { await deleteItemAction(it.id); router.refresh(); }
      catch { enqueue(localQueueStore, op); setQueued((n) => n + 1); }
    });
  }
  function clearDone() {
    const doneIds = all.filter((it) => isChecked(it)).map((it) => it.id);
    setRemoved((r) => ({ ...r, ...Object.fromEntries(doneIds.map((id) => [id, true])) }));
    start(async () => { await clearCheckedAction(); router.refresh(); });
  }

  /* --------------------- Drag-and-drop (Pointer, auch Touch) --------------------- */
  function storeAtPoint(x: number, y: number): string | null {
    for (const [store, el] of sectionEls.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return store;
    }
    return null;
  }
  function dragStart(e: React.PointerEvent, it: Item, from: string) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: it.id, text: it.text, x: e.clientX, y: e.clientY, from });
  }
  function dragMove(e: React.PointerEvent) {
    if (!drag) return;
    setDrag({ ...drag, x: e.clientX, y: e.clientY });
    setHoverStore(storeAtPoint(e.clientX, e.clientY));
  }
  function dragEnd() {
    if (drag && hoverStore && hoverStore !== drag.from) {
      const { id } = drag;
      const target = hoverStore;
      setStoreOverride((s) => ({ ...s, [id]: target }));
      start(() => { void moveItemAction(id, target); });
    }
    setDrag(null);
    setHoverStore(null);
  }

  /*
   * Die Vorschläge standen bis eben über dem Eingabefeld unten. Das Feld ist
   * weg — Erfassen passiert jetzt im Blatt hinter dem „+". Die Vorschläge
   * bleiben aber sichtbar: Sie sind ein Tipp, keine Eingabe, und wer sie erst
   * aufklappen muss, sieht sie nie.
   */
  const offeneVorschlaege = suggestions.filter((x) => !usedSuggestions.includes(x));

  /** Die Geschäfte für das Blatt — dieselben Fächer, die auch die Liste zeigt. */
  const geschaefte = sections.map((s) => ({ key: s.store, label: s.label }));

  return (
    <AppShell
      floating={
        <>
          {drag && <DragGhost drag={drag} />}
          <FabKnopf onClick={() => setErfassen(true)} label="Sachen auf die Liste setzen" />
        </>
      }
    >
      <>
        <h1 className="font-display text-4xl">Einkaufsliste</h1>
        <p className="mt-2 flex items-center gap-2 text-ink-muted">
          <span className="flex -space-x-1.5">
            <Avatar person={PLATZ_A} size={22} />
            <Avatar person={PLATZ_B} size={22} />
          </span>
          Gemeinsam mit {partnerName} · {openCount} offen
        </p>
        {offeneVorschlaege.length > 0 && (
          <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto pb-0.5">
            {offeneVorschlaege.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => addSuggestion(x)}
                className="shrink-0 rounded-pill bg-surface px-3 py-1.5 text-sm text-ink shadow-card"
              >
                + {x}
              </button>
            ))}
          </div>
        )}

        {(!online || queued > 0) && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-pill bg-counter-light px-3 py-1.5 text-sm font-medium text-signal">
            <span className="h-2 w-2 rounded-full bg-signal" />
            {!online
              ? `Offline — ${queued} Änderung${queued === 1 ? "" : "en"} wird gespeichert`
              : `${queued} Änderung${queued === 1 ? "" : "en"} wird synchronisiert …`}
          </div>
        )}

        {/* Während des Ziehens Textauswahl global unterbinden (iOS-Markieren) */}
        <div className={`mt-5 flex flex-col gap-4 ${drag ? "select-none" : ""}`}>
          {sections.map((s) => (
            <section
              key={s.store}
              ref={(el) => { if (el) sectionEls.current.set(s.store, el); }}
              className={`rounded-card bg-surface p-3 shadow-card transition-shadow ${
                hoverStore === s.store && drag && drag.from !== s.store
                  ? "ring-2 ring-[var(--color-accent)]"
                  : ""
              }`}
            >
              {/* Hier saß bis eben ein zweites, kleineres „+" je Fach mit
                  eigenem Eingabefeld. Zwei verschieden aussehende Plus-Zeichen
                  auf einer Seite sind zwei Knöpfe für dieselbe Sache — und das
                  Geschäft wählt man jetzt im Blatt, in einem Tipp. */}
              <div className="mb-1 px-1">
                <p className="eyebrow text-accent">{s.label}</p>
              </div>
              {s.open.length + s.done.length === 0 && pendingAddsFor(s.store, pendingAdds).length === 0 ? (
                <p className="px-1 py-1.5 text-xs text-ink-muted/60">
                  {drag ? "Hierher ziehen" : "Leer"}
                </p>
              ) : (
                <div>
                  {s.open.map((it) => (
                    <Row key={it.id} it={it} checked={false}
                      dragging={drag?.id === it.id}
                      onToggle={() => toggle(it)} onRemove={() => remove(it)}
                      onDragStart={(e) => dragStart(e, it, s.store)} onDragMove={dragMove} onDragEnd={dragEnd}
                    />
                  ))}
                  {s.done.map((it) => (
                    <Row key={it.id} it={it} checked
                      dragging={drag?.id === it.id}
                      onToggle={() => toggle(it)} onRemove={() => remove(it)}
                      onDragStart={(e) => dragStart(e, it, s.store)} onDragMove={dragMove} onDragEnd={dragEnd}
                    />
                  ))}
                </div>
              )}
              {s.store === OHNE_LADEN && pendingAdds.length > 0 && (
                <div className="mt-1 border-t border-surface-muted/60 pt-1">
                  {pendingAdds.map((t, i) => (
                    <div key={i} className="flex items-center gap-2.5 py-1.5 opacity-70">
                      <span className="h-5 w-5 shrink-0 rounded-full border-2 border-dashed border-ink-muted/40" />
                      <span className="text-[15px]">{t}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}

          {/* Anlegen im Moment des Bedarfs — der Weg über die Einstellungen
              bleibt für Umbenennen und Löschen. */}
          <div className="px-1 pt-1">
            <NeuesFachChip
              label="+ Geschäft"
              placeholder="Wie heißt das Geschäft?"
              onCreate={createStoreAction}
            />
          </div>
        </div>

        <AnimatePresence>
          {doneCount > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={clearDone}
              className="mt-4 w-full rounded-pill bg-surface-muted px-5 py-3 text-sm font-medium text-ink"
            >
              Alles erledigt — {doneCount} abgehakte{doneCount === 1 ? "n" : ""} Artikel entfernen
            </motion.button>
          )}
          {allDone && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 rounded-pill bg-accent-light px-4 py-2 text-center text-sm font-medium text-ink"
            >
              Alles erledigt ✓
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {erfassen && (
            <ErfassenSheet
              geschaefte={geschaefte}
              onZu={() => setErfassen(false)}
              onGespeichert={() => router.refresh()}
            />
          )}
        </AnimatePresence>
      </>
    </AppShell>
  );
}

/** Zieh-Vorschau unterm Finger — liegt in der App-Huelle, nicht im Scrollbereich. */
function DragGhost({ drag }: { drag: Drag }) {
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-pill bg-ink px-3 py-1.5 text-sm text-surface shadow-hero"
      style={{ left: drag.x, top: drag.y, transform: "translate(-50%, -130%)" }}
    >
      {drag.text}
    </div>
  );
}

function pendingAddsFor(store: string, adds: string[]): string[] {
  // Ohne Laden abgeschickt = wartet im Auffangfach.
  return store === OHNE_LADEN ? adds : [];
}

function Row({
  it,
  checked,
  dragging,
  onToggle,
  onRemove,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  it: Item;
  checked: boolean;
  dragging: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onDragMove: (e: React.PointerEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <SwipeRow onSwipeRight={onToggle} onSwipeLeft={onRemove} rightLabel={checked ? "Öffnen" : "Abgehakt"}>
    <div
      className={`flex items-center gap-2.5 border-b border-surface-muted/50 py-1.5 last:border-0 ${
        dragging ? "opacity-40" : ""
      }`}
    >
      <button
        onClick={onToggle}
        aria-label={checked ? "Wieder öffnen" : "Abhaken"}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150 ${
          checked ? "border-accent bg-accent text-surface" : "border-ink-muted/40"
        }`}
      >
        {checked && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <button
        onClick={onToggle}
        className={`min-w-0 flex-1 truncate text-left text-[15px] ${checked ? "text-ink-muted line-through" : ""}`}
      >
        {it.text}
      </button>
      {it.addedByPerson && <Avatar person={it.addedByPerson} size={16} />}
      <button onClick={onRemove} aria-label="Entfernen" className="px-0.5 text-ink-muted/40">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {/* Drag-Griff: touch-action/user-select none nur hier — Seite bleibt scrollbar,
          und iOS startet kein Text-Markieren/Long-Press-Menü. Große Trefferfläche. */}
      <span
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        onContextMenu={(e) => e.preventDefault()}
        className="-my-1 cursor-grab px-2 py-2.5 text-ink-muted/50 active:cursor-grabbing"
        style={{
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        }}
        aria-label="Verschieben"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
        </svg>
      </span>
    </div>
    </SwipeRow>
  );
}
