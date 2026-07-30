import type { Person } from "@/lib/auth/allowlist";
import { dayKey } from "@/lib/calendar/format";

/** Aufgaben-Gruppierung nach ETA (Abschnitt Aufgaben): rein & testbar. */

export type TodoVM = {
  id: string;
  title: string;
  notes: string | null;
  dueKey: string | null; // YYYY-MM-DD (Berlin) oder null
  dueLabel: string | null;
  assignee: Person | null;
  createdBy: Person | null;
  done: boolean;
  overdue: boolean;
  hasReminder: boolean;
};

export type TodoGroup = { key: string; label: string; todos: TodoVM[] };

const dueFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/Berlin",
});

export function buildTodoVM(
  row: {
    id: string;
    title: string;
    notes: string | null;
    dueDate: Date | null;
    assignee: string | null;
    createdBy: string | null;
    status: string;
    remindAt: Date | null;
  },
  now: Date = new Date(),
): TodoVM {
  const done = row.status === "erledigt";
  const dueKey = row.dueDate ? dayKey(row.dueDate) : null;
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    dueKey,
    dueLabel: row.dueDate ? dueFmt.format(row.dueDate) : null,
    assignee: row.assignee === "dirk" || row.assignee === "constanze" ? row.assignee : null,
    createdBy: row.createdBy === "dirk" || row.createdBy === "constanze" ? row.createdBy : null,
    done,
    overdue: !done && !!dueKey && dueKey < dayKey(now),
    hasReminder: !!row.remindAt,
  };
}

/**
 * Gruppen in fester Reihenfolge: Überfällig, Heute, Diese Woche (nächste 7 Tage),
 * Später, Ohne Termin, Erledigt. Leere Gruppen entfallen.
 */
export function groupTodos(todos: TodoVM[], now: Date = new Date()): TodoGroup[] {
  const today = dayKey(now);
  const weekEnd = dayKey(new Date(now.getTime() + 7 * 86_400_000));

  const buckets: Record<string, TodoVM[]> = {
    ueberfaellig: [],
    heute: [],
    woche: [],
    spaeter: [],
    ohne: [],
    erledigt: [],
  };

  for (const t of todos) {
    if (t.done) buckets.erledigt.push(t);
    else if (!t.dueKey) buckets.ohne.push(t);
    else if (t.dueKey < today) buckets.ueberfaellig.push(t);
    else if (t.dueKey === today) buckets.heute.push(t);
    else if (t.dueKey <= weekEnd) buckets.woche.push(t);
    else buckets.spaeter.push(t);
  }

  const LABELS: [string, string][] = [
    ["ueberfaellig", "Überfällig"],
    ["heute", "Heute"],
    ["woche", "Diese Woche"],
    ["spaeter", "Später"],
    ["ohne", "Ohne Termin"],
    ["erledigt", "Erledigt"],
  ];

  return LABELS.filter(([k]) => buckets[k].length > 0).map(([key, label]) => ({
    key,
    label,
    todos: buckets[key],
  }));
}
