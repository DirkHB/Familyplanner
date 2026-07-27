import { describe, it, expect } from "vitest";
import {
  loadQueue,
  saveQueue,
  enqueue,
  clearQueue,
  collapseOps,
  type QueueStore,
  type QueuedOp,
} from "./queue";

function memStore(): QueueStore {
  let v: string | null = null;
  return { get: () => v, set: (x) => { v = x; } };
}

describe("offline queue", () => {
  it("lädt leer bei fehlendem/kaputtem Inhalt", () => {
    const s = memStore();
    expect(loadQueue(s)).toEqual([]);
    s.set("kein-json");
    expect(loadQueue(s)).toEqual([]);
  });

  it("enqueue hängt an und persistiert", () => {
    const s = memStore();
    enqueue(s, { kind: "toggle", id: "1", ts: 1 });
    enqueue(s, { kind: "add", text: "Milch", ts: 2 });
    expect(loadQueue(s)).toHaveLength(2);
  });

  it("clearQueue leert", () => {
    const s = memStore();
    saveQueue(s, [{ kind: "toggle", id: "1", ts: 1 }]);
    clearQueue(s);
    expect(loadQueue(s)).toEqual([]);
  });
});

describe("collapseOps", () => {
  it("entfernt gerade Toggle-Paare (Netto null)", () => {
    const ops: QueuedOp[] = [
      { kind: "toggle", id: "a", ts: 1 },
      { kind: "toggle", id: "a", ts: 2 },
    ];
    expect(collapseOps(ops)).toEqual([]);
  });

  it("behält ungerade Toggles einmal an erster Position", () => {
    const ops: QueuedOp[] = [
      { kind: "toggle", id: "a", ts: 1 },
      { kind: "toggle", id: "a", ts: 2 },
      { kind: "toggle", id: "a", ts: 3 },
    ];
    const out = collapseOps(ops);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "toggle", id: "a", ts: 1 });
  });

  it("erhält add/delete in Reihenfolge", () => {
    const ops: QueuedOp[] = [
      { kind: "add", text: "Brot", ts: 1 },
      { kind: "toggle", id: "b", ts: 2 },
      { kind: "delete", id: "c", ts: 3 },
    ];
    const out = collapseOps(ops);
    expect(out.map((o) => o.kind)).toEqual(["add", "toggle", "delete"]);
  });
});
