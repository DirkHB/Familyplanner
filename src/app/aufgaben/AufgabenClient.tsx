"use client";

import { useActionState, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { SwipeRow } from "@/components/ui/SwipeRow";
import { AppShell } from "@/components/app/AppShell";
import { SegmentedNav } from "@/components/app/SegmentedNav";
import type { Person } from "@/lib/auth/allowlist";
import { ALLE_LISTEN, OHNE_LISTE, NEUE_LISTE, type TodoGroup, type TodoVM } from "@/lib/todos/group";
import { MAX_NAME_LAENGE } from "@/lib/names";
import type { CareDay } from "@/lib/care/upcoming";
import Link from "next/link";
import { NeuesFachChip } from "@/components/ui/NeuesFachChip";
import { createTodoListAction } from "@/app/einstellungen/actions";
import {
  createTodoAction,
  toggleTodoAction,
  deleteTodoAction,
  setTodoAssigneeAction,
  setTodoDueAction,
  toggleTodoImportantAction,
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
  einkaufOffen = 0,
  todoLists = [],
}: {
  groups: TodoGroup[];
  me: Person;
  eventTasks?: EventTasks[];
  careDays?: CareDay[];
  /** Offene Einkaufsposten — als Zahl am Umschalter. */
  einkaufOffen?: number;
  todoLists?: { id: string; name: string }[];
}) {
  const [filter, setFilter] = useState<Filter>("alle");
  const [liste, setListe] = useState<string>(ALLE_LISTEN);
  const [showForm, setShowForm] = useState(false);

  // Gibt es die gewählte Liste nicht mehr (in einem anderen Gerät gelöscht),
  // wäre sonst dauerhaft alles leer. Dann lieber wieder alles zeigen.
  const listeGibtEs =
    liste === ALLE_LISTEN || liste === OHNE_LISTE || todoLists.some((l) => l.id === liste);
  const aktiveListe = listeGibtEs ? liste : ALLE_LISTEN;

  const filtered = groups
    .map((g) => ({
      ...g,
      todos: g.todos
        .filter((t) => filter === "alle" || t.assignee === filter)
        .filter(
          (t) =>
            aktiveListe === ALLE_LISTEN ||
            (aktiveListe === OHNE_LISTE ? t.listId === null : t.listId === aktiveListe),
        ),
    }))
    .filter((g) => g.todos.length > 0);

  // Zahlen an den Listen-Umschaltern: offene Aufgaben, den Personenfilter
  // mitgerechnet — sonst stünde dort eine Zahl, die man nicht wiederfindet.
  const sichtbar = groups.flatMap((g) => g.todos).filter((t) => filter === "alle" || t.assignee === filter);
  const zahlFuer = (key: string) =>
    sichtbar.filter(
      (t) =>
        !t.done &&
        (key === ALLE_LISTEN || (key === OHNE_LISTE ? t.listId === null : t.listId === key)),
    ).length;
  const ohneListe = sichtbar.some((t) => t.listId === null);

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

        {/* Listen als Umschalter. Gibt es noch keine, bleibt nur der stille
            „+ Liste"-Chip — er ist der Einstieg, nicht die Einstellungen. */}
        <div className="-mx-5 mt-3 overflow-x-auto px-5" style={{ touchAction: "pan-x pan-y" }}>
          <div className="flex w-max items-center gap-2">
            {todoLists.length > 0 &&
              [
                { key: ALLE_LISTEN, name: "Alle Listen" },
                ...todoLists.map((l) => ({ key: l.id, name: l.name })),
                ...(ohneListe ? [{ key: OHNE_LISTE, name: "Ohne Liste" }] : []),
              ].map((l) => {
                const aktiv = aktiveListe === l.key;
                const n = zahlFuer(l.key);
                return (
                  <button
                    key={l.key}
                    onClick={() => setListe(l.key)}
                    className={`flex shrink-0 items-center gap-2 rounded-pill px-4 py-2 text-sm font-medium transition-colors ${
                      aktiv ? "bg-accent text-surface" : "bg-surface text-ink shadow-card"
                    }`}
                  >
                    {l.name}
                    {n > 0 && (
                      <span className={aktiv ? "text-surface/70" : "text-ink-muted"}>{n}</span>
                    )}
                  </button>
                );
              })}
            <NeuesFachChip
              label="+ Liste"
              placeholder="Wie soll sie heißen?"
              onCreate={createTodoListAction}
              // Gleich hinschalten: Wer eine Liste anlegt, will sie füllen.
              onCreated={(id) => id && setListe(id)}
            />
          </div>
        </div>

        {showForm && (
          <CreateForm
            me={me}
            todoLists={todoLists}
            vorauswahl={aktiveListe === ALLE_LISTEN || aktiveListe === OHNE_LISTE ? null : aktiveListe}
            onDone={() => setShowForm(false)}
          />
        )}

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
  const [important, setImportant] = useState(todo.important);
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
