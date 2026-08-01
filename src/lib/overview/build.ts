import type { Person } from "@/lib/auth/allowlist";

/**
 * Überblick — die zwei Fragen, die im Alltag zählen:
 *   1. Wie sieht die Woche aus?  2. Was ist noch offen?
 * Reine Aufbereitung, keine DB/KI → sofort und testbar.
 */

export type OverviewEvent = {
  dayKey: string;
  dayLabel: string;
  time: string;
  title: string;
  uid: string;
  allDay: boolean;
  /**
   *  "offen"  — jemand wurde gefragt, es fehlt die Antwort
   *  "da"     — jemand hat die Betreuung übernommen
   *  "luecke" — noch nie besprochen, fällt aber in Nicolas' Wachzeit
   *  null     — keine Betreuungsfrage
   */
  care: "offen" | "da" | "luecke" | null;
  carePerson: Person | null;
  /** Für die Schnellaktionen im Überblick (Betreuung übernehmen / abwinken). */
  occurrenceISO?: string;
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
  | { kind: "luecke"; uid: string; label: string; when: string; occurrenceISO: string | null }
  | { kind: "todo"; id: string; label: string; when: string | null; overdue: boolean };

export type Overview = {
  days: { key: string; label: string; events: OverviewEvent[] }[];
  eventCount: number;
  open: OpenItem[];
};

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

  // 2. Offen — erst was schon gefragt wurde, dann die noch gar nicht besprochenen
  // Termine, dann überfällige und restliche Aufgaben.
  const open: OpenItem[] = [];
  const wann = (e: OverviewEvent) => `${e.dayLabel}${e.time ? `, ${e.time}` : ""}`;
  for (const e of input.events) {
    if (e.care === "offen") {
      open.push({ kind: "care", uid: e.uid, label: e.title, when: wann(e) });
    }
  }
  for (const e of input.events) {
    if (e.care === "luecke") {
      open.push({ kind: "luecke", uid: e.uid, label: e.title, when: wann(e), occurrenceISO: e.occurrenceISO ?? null });
    }
  }
  const overdue = input.todos.filter((t) => t.overdue);
  const rest = input.todos.filter((t) => !t.overdue);
  for (const t of [...overdue, ...rest]) {
    open.push({ kind: "todo", id: t.id, label: t.title, when: t.dueLabel, overdue: t.overdue });
  }

  return {
    days,
    eventCount: input.events.length,
    open,
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
  const careOpen = o.open.filter((x) => x.kind === "care" || x.kind === "luecke").length;
  if (careOpen) parts.push(`${careOpen}× Betreuung offen`);
  const todos = o.open.filter((x) => x.kind === "todo").length;
  if (todos) parts.push(`${todos} Aufgabe${todos === 1 ? "" : "n"} offen`);
  if (parts.length === 1) parts.push("Alles geklärt ✓");
  return parts.join(" · ").slice(0, 160);
}

