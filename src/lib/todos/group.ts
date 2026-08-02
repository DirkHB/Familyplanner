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
  /** Nur für Undatiertes: hebt die Aufgabe im Fach „Irgendwann" nach oben. */
  important: boolean;
  /** Zu welcher Liste die Aufgabe gehört; `null` heißt „Ohne Liste". */
  listId: string | null;
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
    important?: boolean;
    listId?: string | null;
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
    important: !!row.important,
    listId: row.listId ?? null,
  };
}

/** Kennung für „alle Listen zusammen" — der Normalfall beim Öffnen. */
export const ALLE_LISTEN = "alle";

/**
 * Formular-Kennung für „Neue Liste …" im Anlege-Formular. Kollidiert nie mit
 * echten Listen-Ids (das sind cuids). Formular und Server-Aktion müssen
 * dieselbe Kennung meinen — deshalb steht sie hier und nicht doppelt.
 */
export const NEUE_LISTE = "__neu";

/** Kennung für Aufgaben ohne Liste. Kein Datensatz, sondern die Abwesenheit. */
export const OHNE_LISTE = "ohne";

/**
 * Aufgaben auf eine Liste einschränken.
 *
 * Die Liste ist ein Filter, keine zweite Ordnung: Innerhalb der Auswahl bleibt
 * die Einteilung nach „wann". Fächer nach Liste UND nach Zeitpunkt gleichzeitig
 * wären zwei Ordnungen übereinander — dann findet man gar nichts mehr.
 */
export function filterByList(todos: TodoVM[], auswahl: string): TodoVM[] {
  if (auswahl === ALLE_LISTEN) return todos;
  if (auswahl === OHNE_LISTE) return todos.filter((t) => t.listId === null);
  return todos.filter((t) => t.listId === auswahl);
}

/** Wie viele offene Aufgaben je Liste — für die Zahlen an den Umschaltern. */
export function countOpenByList(todos: TodoVM[]): Map<string, number> {
  const m = new Map<string, number>();
  let alle = 0;
  for (const t of todos) {
    if (t.done) continue;
    alle++;
    const key = t.listId ?? OHNE_LISTE;
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  m.set(ALLE_LISTEN, alle);
  return m;
}

/**
 * Fächer nach „wann", nicht nach „ob".
 *
 * Masicampo und Baumeister (2011): Unerledigtes drängt sich ins Bewusstsein,
 * bis ein konkreter Plan existiert — erledigen muss man es dafür nicht. Eine
 * Aufgabe ohne „wann" kostet also weiter Kopf. Deshalb heißt das Fach für
 * Undatiertes „Irgendwann" statt „Ohne Termin": Es ist ein bewusster Parkplatz,
 * kein Ablagestapel, und wird sonntags durchgesehen.
 *
 * „Überfällig" und „Später" bleiben eigene Fächer, weil das Zusammenlegen
 * Information vernichten würde. Leere Fächer entfallen — im Alltag sieht man
 * darum meist nur zwei oder drei Überschriften.
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
    ["ohne", "Irgendwann"],
    ["erledigt", "Erledigt"],
  ];

  // Im Parkplatz stehen die wichtigen oben — sonst versinken sie.
  buckets.ohne.sort((a, b) => Number(b.important) - Number(a.important));

  return LABELS.filter(([k]) => buckets[k].length > 0).map(([key, label]) => ({
    key,
    label,
    todos: buckets[key],
  }));
}
