"use client";

import { useActionState, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { SwipeRow } from "@/components/ui/SwipeRow";
import { AppShell } from "@/components/app/AppShell";
import type { Person } from "@/lib/auth/allowlist";
import type { TodoGroup, TodoVM } from "@/lib/todos/group";
import type { CareDay } from "@/lib/care/upcoming";
import Link from "next/link";
import {
  createTodoAction,
  toggleTodoAction,
  deleteTodoAction,
  setTodoAssigneeAction,
  setTodoDueAction,
  togglePrepItemAction,
} from "./actions";

export type EventTasks = {
  eventUid: string;
  title: string;
  dayLabel: string;
  sort: number;
  items: { idx: number; text: string; done: boolean }[];
};

type Filter = "alle" | Person;

export function AufgabenClient({
  groups,
  me,
  eventTasks = [],
  careDays = [],
}: {
  groups: TodoGroup[];
  me: Person;
  eventTasks?: EventTasks[];
  careDays?: CareDay[];
}) {
  const [filter, setFilter] = useState<Filter>("alle");
  const [showForm, setShowForm] = useState(false);

  const filtered = groups
    .map((g) => ({
      ...g,
      todos: filter === "alle" ? g.todos : g.todos.filter((t) => t.assignee === filter),
    }))
    .filter((g) => g.todos.length > 0);

  return (
    <AppShell>
      <>
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

        {/* Filter: Alle / Constanze / Dirk */}
        <div className="mt-4 flex gap-2">
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
        </div>

        {showForm && <CreateForm me={me} onDone={() => setShowForm(false)} />}

        {careDays.length > 0 && filter === "alle" && (
          <section className="mt-6">
            <h2 className="eyebrow mb-2 text-ink-muted">Wer ist bei Nicolas?</h2>
            <div className="flex flex-col gap-4">
              {careDays.map((d) => (
                <div key={d.key}>
                  <p className={`mb-1.5 text-xs font-medium ${d.past ? "text-signal" : "text-ink-muted"}`}>
                    {d.label}
                    {d.past ? " · vorbei" : ""}
                  </p>
                  <div className="flex flex-col gap-2">
                    {d.slots.map((s) => (
                      <CareSlotRow key={s.id} slot={s} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {filtered.length === 0 && !showForm ? (
          <div className="mt-10 rounded-card bg-surface p-6 text-center shadow-card">
            <p className="font-display text-xl">Nichts offen</p>
            <p className="mt-2 text-ink-muted">Leg oben rechts eine Aufgabe an — für dich oder den anderen.</p>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-6">
            {filtered.map((g) => (
              <section key={g.key}>
                <h2 className={`eyebrow mb-2 ${g.key === "ueberfaellig" ? "text-signal" : "text-ink-muted"}`}>
                  {g.label}
                </h2>
                <div className="flex flex-col gap-2">
                  {g.todos.map((t) => (
                    <TodoRow key={t.id} todo={t} />
                  ))}
                </div>
              </section>
            ))}
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

const CYCLE: (Person | null)[] = ["constanze", "dirk", null];

/**
 * Eine übernommene Betreuung: Zeitraum, Anlass, Person — auf einen Blick.
 * Rechts wischen = erledigt, links = entfernen (wie überall in der App).
 */
function CareSlotRow({ slot }: { slot: CareDay["slots"][number] }) {
  return (
    <Link href={`/termin/${encodeURIComponent(slot.uid)}`} className="block">
      <div className="rounded-card bg-surface px-4 py-3 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <span className="tnum font-medium">{slot.timeLabel ?? "ganztägig"}</span>
          {slot.person ? (
            <span className="flex shrink-0 items-center gap-1.5">
              <Avatar person={slot.person} size={24} />
              <span className="text-sm font-medium">{slot.person === "constanze" ? "Constanze" : "Dirk"}</span>
            </span>
          ) : (
            <span className="text-sm text-ink-muted/60">offen</span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-ink-muted">{slot.title}</p>
      </div>
    </Link>
  );
}

function TodoRow({ todo }: { todo: TodoVM }) {
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);
  const [assignee, setAssignee] = useState<Person | null>(todo.assignee);
  const [editDue, setEditDue] = useState(false);
  const [due, setDue] = useState(todo.dueKey ?? "");
  if (gone) return null;

  function cycleAssignee() {
    const next = CYCLE[(CYCLE.indexOf(assignee) + 1) % CYCLE.length];
    setAssignee(next);
    start(() => setTodoAssigneeAction(todo.id, next));
  }

  return (
    <SwipeRow
      onSwipeRight={() => start(() => toggleTodoAction(todo.id))}
      onSwipeLeft={() => start(async () => { await deleteTodoAction(todo.id); setGone(true); })}
      rightLabel={todo.done ? "Öffnen" : "Erledigt"}
    >
    <div className="flex items-center gap-3 rounded-card bg-surface px-4 py-3 shadow-card">
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

function CreateForm({ me, onDone }: { me: Person; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(createTodoAction, { error: null });
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
