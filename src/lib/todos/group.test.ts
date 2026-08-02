import { describe, it, expect } from "vitest";
import { buildTodoVM, containersByList, OHNE_LISTE, type TodoVM } from "./group";

// Fixe Referenz: Mittwoch, 30.07.2026, 12:00 Berlin (10:00 UTC).
const NOW = new Date("2026-07-30T10:00:00Z");

function vm(partial: Partial<TodoVM> & { id: string }): TodoVM {
  return {
    title: "x",
    notes: null,
    dueKey: null,
    dueLabel: null,
    assignee: null,
    createdBy: null,
    done: false,
    overdue: false,
    hasReminder: false,
    important: false,
    listId: null,
    ...partial,
  };
}

describe("buildTodoVM", () => {
  it("markiert überfällig nur bei offenem Status und vergangenem Datum", () => {
    const past = new Date("2026-07-28T10:00:00Z");
    const open = buildTodoVM(
      { id: "1", title: "A", notes: null, dueDate: past, assignee: "dirk", createdBy: "constanze", status: "offen", remindAt: null },
      NOW,
    );
    expect(open.overdue).toBe(true);
    expect(open.assignee).toBe("dirk");

    const done = buildTodoVM(
      { id: "2", title: "B", notes: null, dueDate: past, assignee: null, createdBy: null, status: "erledigt", remindAt: null },
      NOW,
    );
    expect(done.overdue).toBe(false);
    expect(done.done).toBe(true);
  });
});
describe("containersByList", () => {
  const listen = [
    { id: "l1", name: "Diese Woche" },
    { id: "l2", name: "Pakete" },
  ];

  it("baut je Liste einen Container, in der Reihenfolge der Listen", () => {
    const { container } = containersByList(
      [vm({ id: "a", listId: "l2" }), vm({ id: "b", listId: "l1" })],
      listen,
    );
    expect(container.map((c) => c.name)).toEqual(["Diese Woche", "Pakete"]);
  });

  it("zeigt leere Listen — wer eine anlegt, muss sie sofort sehen", () => {
    const { container } = containersByList([], listen);
    expect(container).toHaveLength(2);
    expect(container[0].todos).toEqual([]);
  });

  it("sammelt Listenloses in „Ohne Liste“ — auch verwaiste Zuordnungen", () => {
    const { container } = containersByList(
      [vm({ id: "a", listId: null }), vm({ id: "b", listId: "geloescht" })],
      listen,
    );
    const ohne = container.find((c) => c.key === OHNE_LISTE)!;
    expect(ohne.todos.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("„Ohne Liste“ steht ganz oben — der Eingangskorb zum Zuordnen", () => {
    const { container } = containersByList(
      [vm({ id: "a", listId: "l1" }), vm({ id: "b", listId: null })],
      listen,
    );
    expect(container.map((c) => c.key)).toEqual([OHNE_LISTE, "l1", "l2"]);
  });

  it("ordnet im Container: datiert aufsteigend, dann Undatiertes mit wichtig zuerst", () => {
    const { container } = containersByList(
      [
        vm({ id: "spaet", listId: "l1", dueKey: "2026-08-10" }),
        vm({ id: "ohne", listId: "l1" }),
        vm({ id: "frueh", listId: "l1", dueKey: "2026-08-01", overdue: true }),
        vm({ id: "wichtig", listId: "l1", important: true }),
      ],
      listen,
    );
    expect(container[0].todos.map((t) => t.id)).toEqual(["frueh", "spaet", "wichtig", "ohne"]);
    expect(container[0].ueberfaellig).toBe(1);
  });

  it("trennt Erledigtes heraus statt es in den Containern zu begraben", () => {
    const { container, erledigt } = containersByList(
      [vm({ id: "a", listId: "l1" }), vm({ id: "fertig", listId: "l1", done: true })],
      listen,
    );
    expect(container[0].todos.map((t) => t.id)).toEqual(["a"]);
    expect(erledigt.map((t) => t.id)).toEqual(["fertig"]);
  });

  it("ohne Listen: ein kopfloser Container — kein leeres Gerippe", () => {
    const voll = containersByList([vm({ id: "a" })], []);
    expect(voll.container).toHaveLength(1);
    expect(voll.container[0].name).toBe(null);
    expect(containersByList([], []).container).toEqual([]);
  });
});
