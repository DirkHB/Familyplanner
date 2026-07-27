/**
 * Offline-Warteschlange für die Einkaufsliste (Abschnitt 6.3): Aktionen werden bei
 * fehlender Verbindung lokal gepuffert und bei Rückkehr online abgespielt. Wichtig
 * fürs nächtliche Abhaken mit Baby im Arm bei schlechtem Empfang.
 *
 * Client-sicher (kein server-only). Reine Logik ist mit injizierbarem Store testbar.
 */

export type QueuedOp =
  | { kind: "toggle"; id: string; ts: number }
  | { kind: "add"; text: string; ts: number }
  | { kind: "delete"; id: string; ts: number };

export interface QueueStore {
  get(): string | null;
  set(value: string): void;
}

const KEY = "familyplaner:einkauf-queue:v1";

export const localQueueStore: QueueStore = {
  get: () => (typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null),
  set: (v) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, v);
  },
};

export function loadQueue(store: QueueStore): QueuedOp[] {
  try {
    const raw = store.get();
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr as QueuedOp[]) : [];
  } catch {
    return [];
  }
}

export function saveQueue(store: QueueStore, ops: QueuedOp[]): void {
  store.set(JSON.stringify(ops));
}

export function enqueue(store: QueueStore, op: QueuedOp): QueuedOp[] {
  const next = [...loadQueue(store), op];
  saveQueue(store, next);
  return next;
}

export function clearQueue(store: QueueStore): void {
  saveQueue(store, []);
}

/**
 * Kollabiert Toggles gleicher ID nach Parität: gerade Anzahl → entfällt (Netto null),
 * ungerade → ein Toggle an der Position des ersten Vorkommens. add/delete bleiben in
 * Reihenfolge erhalten. Reduziert unnötige Server-Aufrufe beim Abspielen.
 */
export function collapseOps(ops: QueuedOp[]): QueuedOp[] {
  const toggleCount = new Map<string, number>();
  for (const op of ops) if (op.kind === "toggle") toggleCount.set(op.id, (toggleCount.get(op.id) ?? 0) + 1);

  const emitted = new Set<string>();
  const out: QueuedOp[] = [];
  for (const op of ops) {
    if (op.kind !== "toggle") {
      out.push(op);
      continue;
    }
    const count = toggleCount.get(op.id) ?? 0;
    if (count % 2 === 0) continue; // netto keine Änderung
    if (emitted.has(op.id)) continue; // nur einmal an erster Position
    emitted.add(op.id);
    out.push(op);
  }
  return out;
}
