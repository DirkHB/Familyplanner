import type { Person } from "@/lib/auth/allowlist";

/**
 * Überblick — die drei Fragen, die im Alltag zählen:
 *   1. Wie sieht die Woche aus?  2. Was ist noch offen?  3. Wer macht was?
 * Reine Aufbereitung, keine DB/KI → sofort und testbar.
 */

export type OverviewEvent = {
  dayKey: string;
  dayLabel: string;
  time: string;
  title: string;
  uid: string;
  allDay: boolean;
  care: "offen" | "da" | null;
  carePerson: Person | null;
};

export type OverviewTodo = {
  id: string;
  title: string;
  dueLabel: string | null;
  overdue: boolean;
  assignee: Person | null;
};

export type OpenItem =
  | { kind: "care"; uid: string; label: string; when: string }
  | { kind: "todo"; id: string; label: string; when: string | null; overdue: boolean };

export type Split = {
  constanze: number;
  dirk: number;
  offen: number;
  label: string;
};

export type Overview = {
  days: { key: string; label: string; events: OverviewEvent[] }[];
  eventCount: number;
  open: OpenItem[];
  careSplit: Split;
  todoSplit: Split;
};

function nameOf(p: Person): string {
  return p === "constanze" ? "Constanze" : "Dirk";
}

/** Beschreibender Satz zur Verteilung — nie wertend, Constanze zuerst. */
export function splitLabel(constanze: number, dirk: number, offen: number, what: string): string {
  if (constanze + dirk + offen === 0) return `Nichts ${what} eingeplant.`;
  if (constanze === dirk) return `Gleichmäßig verteilt (je ${constanze}).`;
  const more = constanze > dirk ? "Constanze" : "Dirk";
  return `${more} hat mehr ${what} (${constanze} zu ${dirk}).`;
}

export function buildOverview(input: {
  events: OverviewEvent[];
  todos: OverviewTodo[];
}): Overview {
  // 1. Woche — nach Tag gruppiert, Reihenfolge bleibt erhalten.
  const dayMap = new Map<string, { key: string; label: string; events: OverviewEvent[] }>();
  for (const e of input.events) {
    const d = dayMap.get(e.dayKey) ?? { key: e.dayKey, label: e.dayLabel, events: [] };
    d.events.push(e);
    dayMap.set(e.dayKey, d);
  }
  const days = [...dayMap.values()].sort((a, b) => a.key.localeCompare(b.key));

  // 2. Offen — Betreuungslücken zuerst, dann überfällige, dann restliche Aufgaben.
  const open: OpenItem[] = [];
  for (const e of input.events) {
    if (e.care === "offen") {
      open.push({ kind: "care", uid: e.uid, label: e.title, when: `${e.dayLabel}${e.time ? `, ${e.time}` : ""}` });
    }
  }
  const overdue = input.todos.filter((t) => t.overdue);
  const rest = input.todos.filter((t) => !t.overdue);
  for (const t of [...overdue, ...rest]) {
    open.push({ kind: "todo", id: t.id, label: t.title, when: t.dueLabel, overdue: t.overdue });
  }

  // 3. Wer macht was — Betreuung und Aufgaben getrennt zählen.
  let cC = 0, cD = 0, cO = 0;
  for (const e of input.events) {
    if (e.care === "da" && e.carePerson === "constanze") cC++;
    else if (e.care === "da" && e.carePerson === "dirk") cD++;
    else if (e.care === "offen") cO++;
  }
  let tC = 0, tD = 0, tO = 0;
  for (const t of input.todos) {
    if (t.assignee === "constanze") tC++;
    else if (t.assignee === "dirk") tD++;
    else tO++;
  }

  return {
    days,
    eventCount: input.events.length,
    open,
    careSplit: { constanze: cC, dirk: cD, offen: cO, label: splitLabel(cC, cD, cO, "Betreuung") },
    todoSplit: { constanze: tC, dirk: tD, offen: tO, label: splitLabel(tC, tD, tO, "Aufgaben") },
  };
}

/** Kompakter Text für den Push (max. ~160 Zeichen). */
export function briefingText(o: Overview, kind: "morgen" | "woche"): string {
  const parts: string[] = [];
  const heute = o.days[0];
  if (kind === "morgen") {
    parts.push(heute && heute.events.length ? `Heute: ${heute.events.map((e) => e.title).slice(0, 2).join(", ")}` : "Heute nichts im Kalender");
  } else {
    parts.push(o.eventCount ? `${o.eventCount} Termine diese Woche` : "Kaum Termine diese Woche");
  }
  const careOpen = o.open.filter((x) => x.kind === "care").length;
  if (careOpen) parts.push(`${careOpen}× Betreuung offen`);
  const todos = o.open.filter((x) => x.kind === "todo").length;
  if (todos) parts.push(`${todos} Aufgabe${todos === 1 ? "" : "n"} offen`);
  if (parts.length === 1) parts.push("Alles geklärt ✓");
  return parts.join(" · ").slice(0, 160);
}

export { nameOf };
