"use client";

import { useActionState, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { TabBar } from "@/components/app/TabBar";
import type { Person } from "@/lib/auth/allowlist";
import type { TodoGroup, TodoVM } from "@/lib/todos/group";
import { createTodoAction, toggleTodoAction, deleteTodoAction } from "./actions";

type Filter = "alle" | Person;

export function AufgabenClient({ groups, me }: { groups: TodoGroup[]; me: Person }) {
  const [filter, setFilter] = useState<Filter>("alle");
  const [showForm, setShowForm] = useState(false);

  const filtered = groups
    .map((g) => ({
      ...g,
      todos: filter === "alle" ? g.todos : g.todos.filter((t) => t.assignee === filter),
    }))
    .filter((g) => g.todos.length > 0);

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-md px-5 pb-28 pt-8">
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
      </div>
      <TabBar />
    </div>
  );
}

function TodoRow({ todo }: { todo: TodoVM }) {
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);
  if (gone) return null;

  return (
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
      <div className="min-w-0 flex-1">
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
      </div>
      {todo.assignee && <Avatar person={todo.assignee} size={24} />}
      <button
        onClick={() => start(async () => { await deleteTodoAction(todo.id); setGone(true); })}
        className="pl-1 text-sm text-ink-muted/50"
        aria-label="Entfernen"
      >
        ✕
      </button>
    </div>
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
      <div className="flex gap-3">
        <label className="flex-1 text-sm text-ink-muted">
          Bis wann?
          <input
            name="dueDate"
            type="date"
            className="mt-1 w-full rounded-card border border-surface-muted bg-bg px-4 py-2.5 outline-none focus:border-accent"
          />
        </label>
        <label className="flex-1 text-sm text-ink-muted">
          Wer macht's?
          <select
            name="assignee"
            defaultValue={me}
            className="mt-1 w-full rounded-card border border-surface-muted bg-bg px-4 py-2.5 outline-none focus:border-accent"
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
