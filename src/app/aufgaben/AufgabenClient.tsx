"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { SwipeRow } from "@/components/ui/SwipeRow";
import { AppShell } from "@/components/app/AppShell";
import { SegmentedNav } from "@/components/app/SegmentedNav";
import type { Person } from "@/lib/auth/allowlist";
import { containersByList, NEUE_LISTE, type TodoVM } from "@/lib/todos/group";
import { MAX_NAME_LAENGE } from "@/lib/names";
import Link from "next/link";
import { NeuesFachChip } from "@/components/ui/NeuesFachChip";
import { createTodoListAction } from "@/app/einstellungen/actions";
import { useRouter } from "next/navigation";
import { OHNE_LISTE as OHNE } from "@/lib/todos/group";
import {
  createTodoAction,
  toggleTodoAction,
  deleteTodoAction,
  setTodoAssigneeAction,
  setTodoDueAction,
  toggleTodoImportantAction,
  togglePrepItemAction,
  setTodoListAction,
} from "./actions";

/** Laufende Zieh-Geste: welche Aufgabe, wo ist der Finger, woher kommt sie. */
type Zug = { id: string; titel: string; x: number; y: number; von: string };

export type EventTasks = {
  eventUid: string;
  title: string;
  dayLabel: string;
  sort: number;
  items: { idx: number; text: string; done: boolean }[];
};

type Filter = "alle" | Person;

export function AufgabenClient({
  todos,
  me,
  eventTasks = [],
  einkaufOffen = 0,
  todoLists = [],
}: {
  todos: TodoVM[];
  me: Person;
  eventTasks?: EventTasks[];
  /** Offene Einkaufsposten — als Zahl am Umschalter. */
  einkaufOffen?: number;
  todoLists?: { id: string; name: string }[];
}) {
  const [filter, setFilter] = useState<Filter>("alle");
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();
  const [, start] = useTransition();

  /* --------------- Ziehen zwischen Listen (Pointer, auch Touch) --------------- */
  const containerEls = useRef(new Map<string, HTMLElement>());
  const [zug, setZug] = useState<Zug | null>(null);
  const [zugZiel, setZugZiel] = useState<string | null>(null);
  // Optimistisch: Die Zuordnung gilt sofort, der Server zieht nach.
  const [listeOverride, setListeOverride] = useState<Record<string, string>>({});

  function containerAtPoint(x: number, y: number): string | null {
    for (const [key, el] of containerEls.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return key;
    }
    return null;
  }
  function zugStart(e: React.PointerEvent, t: TodoVM, von: string) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setZug({ id: t.id, titel: t.title, x: e.clientX, y: e.clientY, von });
  }
  function zugMove(e: React.PointerEvent) {
    if (!zug) return;
    setZug({ ...zug, x: e.clientX, y: e.clientY });
    setZugZiel(containerAtPoint(e.clientX, e.clientY));
  }
  function zugEnde() {
    if (zug && zugZiel && zugZiel !== zug.von) {
      const { id } = zug;
      const ziel = zugZiel;
      setListeOverride((o) => ({ ...o, [id]: ziel }));
      start(async () => {
        await setTodoListAction(id, ziel === OHNE ? null : ziel);
        router.refresh();
      });
    }
    setZug(null);
    setZugZiel(null);
  }

  const sichtbar = todos
    .map((t) => {
      const ziel = listeOverride[t.id];
      if (ziel === undefined) return t;
      return { ...t, listId: ziel === OHNE ? null : ziel };
    })
    .filter((t) => filter === "alle" || t.assignee === filter);
  const { container, erledigt } = containersByList(sichtbar, todoLists);
  const nichtsOffen = container.every((c) => c.todos.length === 0);

  return (
    <AppShell>
      <>
        <div className="mb-4">
          <SegmentedNav
            active="/aufgaben"
            items={[
              { href: "/aufgaben", label: "Aufgaben" },
              { href: "/einkauf", label: "Einkauf", badge: einkaufOffen },
            ]}
          />
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-4xl">Aufgaben</h1>
            <p className="mt-2 text-ink-muted">Was ansteht — und wer dran ist</p>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-surface shadow-card"
            aria-label="Aufgabe hinzufügen"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Personenfilter und „+ Liste" in einer Reihe: Der Chip steht damit
            an einer festen Stelle ganz oben — nicht mehr am Ende einer
            wachsenden Umschalter-Reihe, wo man ihm hinterherscrollen muss. */}
        <div className="mt-4 flex items-center gap-2">
          {(
            [
              ["alle", "Alle"],
              ["constanze", "Constanze"],
              ["dirk", "Dirk"],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-pill px-4 py-2 text-sm font-medium transition-colors ${
                filter === key ? "bg-ink text-surface" : "bg-surface text-ink shadow-card"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto">
            <NeuesFachChip label="+ Liste" placeholder="Wie soll sie heißen?" onCreate={createTodoListAction} />
          </span>
        </div>

        {showForm && <CreateForm me={me} todoLists={todoLists} onDone={() => setShowForm(false)} />}

        {nichtsOffen && !showForm && (
          <div className="mt-6 rounded-card bg-surface p-6 text-center shadow-card">
            <p className="font-display text-xl">Nichts offen</p>
            <p className="mt-2 text-ink-muted">Leg oben rechts eine Aufgabe an — für dich oder den anderen.</p>
          </div>
        )}

        {/* Die Listen als Container — die Listen SIND die Ordnung. Im
            Container ordnet der Zeitpunkt; Überfälliges steht oben und der
            Kopf zählt es rot an. „Ohne Liste" steht als Eingangskorb ganz
            oben, und jeder Container ist ein Ablageziel fürs Ziehen. */}
        <div className="mt-5 flex flex-col gap-4">
          {container.map((c) => (
            <section
              key={c.key}
              ref={(el) => {
                if (el) containerEls.current.set(c.key, el);
                else containerEls.current.delete(c.key);
              }}
              className={`overflow-hidden rounded-card bg-surface shadow-card transition-shadow ${
                zug && zugZiel === c.key && zug.von !== c.key ? "ring-2 ring-accent" : ""
              }`}
            >
              {c.name && (
                <header className="flex items-baseline gap-2 px-4 pb-1 pt-3">
                  <h2 className="min-w-0 truncate font-display text-lg">{c.name}</h2>
                  {c.todos.length > 0 && (
                    <span className="text-sm text-ink-muted">{c.todos.length}</span>
                  )}
                  {c.ueberfaellig > 0 && (
                    <span className="ml-auto shrink-0 text-sm font-medium text-signal">
                      {c.ueberfaellig} überfällig
                    </span>
                  )}
                </header>
              )}
              {c.key === OHNE && todoLists.length > 0 && (
                <p className="px-4 pb-1 text-xs text-ink-muted/80">
                  Noch keiner Liste zugeordnet — am Griff ⋮⋮ auf eine Liste ziehen.
                </p>
              )}
              {c.todos.length > 0 ? (
                <div className="divide-y divide-surface-muted/60">
                  {c.todos.map((t) => (
                    <TodoRow
                      key={t.id}
                      todo={t}
                      dragging={zug?.id === t.id}
                      onZugStart={(e) => zugStart(e, t, c.key)}
                      onZugMove={zugMove}
                      onZugEnde={zugEnde}
                    />
                  ))}
                </div>
              ) : (
                <p className="px-4 pb-3 pt-1 text-sm text-ink-muted/70">
                  {zug ? "Hierher ziehen" : "Leer"}
                </p>
              )}
            </section>
          ))}

          {erledigt.length > 0 && <ErledigtContainer erledigt={erledigt} />}
        </div>

        {/* Geist der gezogenen Aufgabe unterm Finger */}
        {zug && (
          <div
            className="pointer-events-none fixed z-50 max-w-[70vw] -translate-x-1/2 -translate-y-[130%] truncate rounded-pill bg-ink px-4 py-2 text-sm font-medium text-surface shadow-hero"
            style={{ left: zug.x, top: zug.y }}
          >
            {zug.titel}
          </div>
        )}

        {eventTasks.length > 0 && (
          <section className="mt-8">
            <h2 className="eyebrow mb-2 text-ink-muted">Aus Terminen</h2>
            <div className="flex flex-col gap-3">
              {eventTasks.map((e) => (
                <EventTaskCard key={e.eventUid} e={e} />
              ))}
            </div>
          </section>
        )}
      </>
    </AppShell>
  );
}

/**
 * Erledigtes ist standardmäßig zugeklappt: Beim Öffnen zählt, was ansteht —
 * nicht, was geschafft ist. Ein Tipp klappt es auf, falls man sich verklickt
 * hat und etwas zurückholen will.
 */
function ErledigtContainer({ erledigt }: { erledigt: TodoVM[] }) {
  const [offen, setOffen] = useState(false);
  return (
    <section className="overflow-hidden rounded-card bg-surface shadow-card">
      <button
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="flex w-full items-baseline gap-2 px-4 py-3 text-left"
      >
        <h2 className="font-display text-lg text-ink-muted">Erledigt</h2>
        <span className="text-sm text-ink-muted">{erledigt.length}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          className="ml-auto shrink-0 self-center text-ink-muted/70"
          style={{ transform: offen ? "rotate(90deg)" : "none", transition: "transform 180ms" }}
          aria-hidden
        >
          <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {offen && (
        <div className="divide-y divide-surface-muted/60 border-t border-surface-muted/60">
          {erledigt.map((t) => (
            <TodoRow key={t.id} todo={t} />
          ))}
        </div>
      )}
    </section>
  );
}

const CYCLE: (Person | null)[] = ["constanze", "dirk", null];

function TodoRow({
  todo,
  dragging = false,
  onZugStart,
  onZugMove,
  onZugEnde,
}: {
  todo: TodoVM;
  dragging?: boolean;
  onZugStart?: (e: React.PointerEvent) => void;
  onZugMove?: (e: React.PointerEvent) => void;
  onZugEnde?: () => void;
}) {
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);
  const [assignee, setAssignee] = useState<Person | null>(todo.assignee);
  const [editDue, setEditDue] = useState(false);
  const [due, setDue] = useState(todo.dueKey ?? "");
  const [important, setImportant] = useState(todo.important);
  if (gone) return null;

  function cycleAssignee() {
    const next = CYCLE[(CYCLE.indexOf(assignee) + 1) % CYCLE.length];
    setAssignee(next);
    start(() => setTodoAssigneeAction(todo.id, next));
  }

  return (
    <SwipeRow
      flach
      onSwipeRight={() => start(() => toggleTodoAction(todo.id))}
      onSwipeLeft={() => start(async () => { await deleteTodoAction(todo.id); setGone(true); })}
      rightLabel={todo.done ? "Öffnen" : "Erledigt"}
    >
    {/* Flache Zeile — die Karte stellt der Container. */}
    <div className={`flex items-center gap-3 bg-surface px-4 py-3 ${dragging ? "opacity-40" : ""}`}>
      <button
        onClick={() => start(() => toggleTodoAction(todo.id))}
        disabled={pending}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
          todo.done ? "border-accent bg-accent text-surface" : "border-ink-muted/40"
        }`}
        aria-label={todo.done ? "Wieder öffnen" : "Erledigt"}
      >
        {todo.done && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <button onClick={() => setEditDue((e) => !e)} className="min-w-0 flex-1 text-left">
        <p className={`truncate font-medium ${todo.done ? "text-ink-muted line-through" : ""}`}>{todo.title}</p>
        {(todo.dueLabel || todo.notes) && (
          <p className="truncate text-xs text-ink-muted">
            {todo.dueLabel && (
              <span className={todo.overdue ? "font-medium text-signal" : ""}>{todo.dueLabel}</span>
            )}
            {todo.dueLabel && todo.notes ? " · " : ""}
            {todo.notes}
            {todo.hasReminder ? " · 🔔" : ""}
          </p>
        )}
      </button>
      {!todo.dueKey && !todo.done && (
        <button
          onClick={() => {
            setImportant((v) => !v);
            start(async () => { await toggleTodoImportantAction(todo.id); });
          }}
          aria-label={important ? "Nicht mehr wichtig" : "Als wichtig markieren"}
          aria-pressed={important}
          className="shrink-0 px-1"
        >
          <svg width="18" height="18" viewBox="0 0 24 24"
            fill={important ? "var(--color-counter)" : "none"}
            stroke={important ? "var(--color-counter)" : "currentColor"}
            strokeWidth="1.7" strokeLinejoin="round"
            className={important ? "" : "text-ink-muted/40"}>
            <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />
          </svg>
        </button>
      )}
      <button onClick={cycleAssignee} aria-label="Zuständigkeit wechseln" className="shrink-0">
        {assignee ? (
          <Avatar person={assignee} size={24} />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-ink-muted/40 text-[10px] text-ink-muted/60">
            ?
          </span>
        )}
      </button>
      <button
        onClick={() => start(async () => { await deleteTodoAction(todo.id); setGone(true); })}
        className="pl-1 text-sm text-ink-muted/50"
        aria-label="Entfernen"
      >
        ✕
      </button>
      {onZugStart && (
        /* Zieh-Griff wie im Einkauf: touch-action/user-select none nur hier —
           die Seite bleibt scrollbar, iOS startet kein Long-Press-Menü. */
        <span
          onPointerDown={onZugStart}
          onPointerMove={onZugMove}
          onPointerUp={onZugEnde}
          onPointerCancel={onZugEnde}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="In eine andere Liste ziehen"
          className="-my-1 cursor-grab px-1.5 py-2.5 text-ink-muted/50 active:cursor-grabbing"
          style={{
            touchAction: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
          }}
        >
          <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor" aria-hidden>
            <circle cx="4" cy="3" r="1.4" />
            <circle cx="10" cy="3" r="1.4" />
            <circle cx="4" cy="8" r="1.4" />
            <circle cx="10" cy="8" r="1.4" />
            <circle cx="4" cy="13" r="1.4" />
            <circle cx="10" cy="13" r="1.4" />
          </svg>
        </span>
      )}
    </div>
    {editDue && (
      <div className="mt-1 flex items-center gap-2 rounded-card bg-surface px-4 py-3 shadow-card">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink-muted">
          Bis wann?
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="min-w-0 flex-1 appearance-none rounded-card border border-surface-muted bg-bg px-3 py-2 text-base text-ink outline-none focus:border-accent"
          />
        </label>
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setTodoDueAction(todo.id, due || null);
              setEditDue(false);
            })
          }
          className="shrink-0 rounded-pill bg-accent px-4 py-2 text-sm font-medium text-surface disabled:opacity-60"
        >
          Sichern
        </button>
      </div>
    )}
    </SwipeRow>
  );
}

function CreateForm({
  me,
  onDone,
  todoLists = [],
  vorauswahl = null,
}: {
  me: Person;
  onDone: () => void;
  todoLists?: { id: string; name: string }[];
  /** Steht oben eine Liste im Umschalter, landet die neue Aufgabe dort. */
  vorauswahl?: string | null;
}) {
  const [state, formAction, pending] = useActionState(createTodoAction, { error: null });
  const [listWahl, setListWahl] = useState(vorauswahl ?? "");
  const partner: Person = me === "dirk" ? "constanze" : "dirk";
  const label = (p: Person) => (p === "constanze" ? "Constanze" : "Dirk");

  return (
    <form
      action={async (fd) => {
        await formAction(fd);
        onDone();
      }}
      className="mt-4 flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card"
    >
      <input
        name="title"
        required
        placeholder="Was ist zu tun?"
        className="rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent"
      />
      <input
        name="notes"
        placeholder="Notiz (optional)"
        className="rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent"
      />
      <div className="flex flex-col gap-3">
        <label className="block text-sm text-ink-muted">
          Bis wann?
          <input
            name="dueDate"
            type="date"
            className="mt-1 block w-full min-w-0 appearance-none rounded-card border border-surface-muted bg-bg px-4 py-2.5 text-base text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="block text-sm text-ink-muted">
          Wer macht&apos;s?
          <select
            name="assignee"
            defaultValue={me}
            className="mt-1 block w-full min-w-0 appearance-none rounded-card border border-surface-muted bg-bg px-4 py-2.5 text-base text-ink outline-none focus:border-accent"
          >
            <option value={me}>{label(me)} (ich)</option>
            <option value={partner}>{label(partner)}</option>
            <option value="">Offen</option>
          </select>
        </label>
      </div>
      <label className="block text-sm text-ink-muted">
        In welche Liste?
        <select
          name="listId"
          value={listWahl}
          onChange={(e) => setListWahl(e.target.value)}
          className="mt-1 block w-full min-w-0 appearance-none rounded-card border border-surface-muted bg-bg px-4 py-2.5 text-base text-ink outline-none focus:border-accent"
        >
          <option value="">Ohne Liste</option>
          {todoLists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
          {/* Anlegen im Moment des Bedarfs — wer hier merkt, dass die
              passende Liste fehlt, soll nicht in die Einstellungen müssen. */}
          <option value={NEUE_LISTE}>Neue Liste …</option>
        </select>
      </label>
      {listWahl === NEUE_LISTE && (
        <input
          name="listName"
          autoFocus
          required
          maxLength={MAX_NAME_LAENGE}
          placeholder="Wie soll die Liste heißen?"
          className="rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent"
        />
      )}
      <label className="flex items-center gap-2 text-sm text-ink-muted">
        <input name="remind" type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" />
        Am Fälligkeitstag um 9 Uhr erinnern (Push)
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-pill bg-accent px-5 py-3.5 font-medium text-surface disabled:opacity-60"
      >
        {pending ? "Speichern …" : "Aufgabe anlegen"}
      </button>
      {state?.error && <p className="text-sm text-signal">{state.error}</p>}
    </form>
  );
}


function EventTaskCard({ e }: { e: EventTasks }) {
  const [, start] = useTransition();
  const [override, setOverride] = useState<Record<number, boolean>>({});
  return (
    <div className="rounded-card bg-surface p-4 shadow-card">
      <Link href={`/termin/${encodeURIComponent(e.eventUid)}`} className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate font-medium">{e.title}</span>
        <span className="tnum shrink-0 text-xs text-ink-muted">{e.dayLabel}</span>
      </Link>
      <div className="mt-2 flex flex-col gap-1">
        {e.items.map((it) => {
          const done = override[it.idx] ?? it.done;
          return (
            <button
              key={it.idx}
              onClick={() => {
                setOverride((o) => ({ ...o, [it.idx]: !done }));
                start(() => togglePrepItemAction(e.eventUid, it.idx));
              }}
              className="flex items-center gap-2.5 py-1 text-left"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  done ? "border-accent bg-accent text-surface" : "border-ink-muted/40"
                }`}
              >
                {done && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className={`text-[15px] ${done ? "text-ink-muted line-through" : ""}`}>{it.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
