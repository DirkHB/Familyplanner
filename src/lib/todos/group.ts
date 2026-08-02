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

/**
 * Formular-Kennung für „Neue Liste …" im Anlege-Formular. Kollidiert nie mit
 * echten Listen-Ids (das sind cuids). Formular und Server-Aktion müssen
 * dieselbe Kennung meinen — deshalb steht sie hier und nicht doppelt.
 */
export const NEUE_LISTE = "__neu";

/** Kennung für Aufgaben ohne Liste. Kein Datensatz, sondern die Abwesenheit. */
export const OHNE_LISTE = "ohne";

export type ListenContainer = {
  key: string;
  /** `null` heißt: kopflos — es gibt gar keine Listen, nur Aufgaben. */
  name: string | null;
  todos: TodoVM[];
  ueberfaellig: number;
};

/**
 * Aufgaben als Container je Liste — die Listen SIND die Ordnung.
 *
 * Innerhalb eines Containers ordnet der Zeitpunkt: Datiertes zuerst und
 * aufsteigend (Überfälliges steht damit von selbst oben), Undatiertes
 * dahinter mit den wichtigen zuerst. So bleibt das Zeitsignal erhalten,
 * ohne eine zweite Gliederungsebene aufzumachen.
 *
 * Leere Listen erscheinen bewusst: Wer eben eine angelegt hat, muss sie
 * sofort sehen — und eine Liste, die nur bei Inhalt sichtbar ist, wirkt
 * beim Leeren wie gelöscht. Erledigtes wird separat zurückgegeben.
 */
export function containersByList(
  todos: TodoVM[],
  listen: { id: string; name: string }[],
): { container: ListenContainer[]; erledigt: TodoVM[] } {
  const offen = todos.filter((t) => !t.done);
  const erledigt = todos.filter((t) => t.done);

  const sortiert = (ts: TodoVM[]) =>
    [...ts].sort((a, b) => {
      if (a.dueKey && b.dueKey) return a.dueKey.localeCompare(b.dueKey);
      if (a.dueKey) return -1;
      if (b.dueKey) return 1;
      return Number(b.important) - Number(a.important);
    });

  if (listen.length === 0) {
    return {
      container: offen.length
        ? [
            {
              key: OHNE_LISTE,
              name: null,
              todos: sortiert(offen),
              ueberfaellig: offen.filter((t) => t.overdue).length,
            },
          ]
        : [],
      erledigt,
    };
  }

  const container: ListenContainer[] = listen.map((l) => {
    const eigene = sortiert(offen.filter((t) => t.listId === l.id));
    return {
      key: l.id,
      name: l.name,
      todos: eigene,
      ueberfaellig: eigene.filter((t) => t.overdue).length,
    };
  });

  // Nicht Zugeordnetes steht GANZ OBEN — es ist der Eingangskorb. Wer die
  // Seite öffnet, soll zuerst sehen, was noch keiner Liste gehört, und es
  // wegsortieren, statt dass es unten unbemerkt liegen bleibt.
  const ohne = sortiert(offen.filter((t) => t.listId === null || !listen.some((l) => l.id === t.listId)));
  if (ohne.length > 0) {
    container.unshift({
      key: OHNE_LISTE,
      name: "Ohne Liste",
      todos: ohne,
      ueberfaellig: ohne.filter((t) => t.overdue).length,
    });
  }

  return { container, erledigt };
}

