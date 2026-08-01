import { describe, it, expect } from "vitest";
import { buildTodoVM, groupTodos, type TodoVM } from "./group";

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

describe("groupTodos", () => {
  it("sortiert in die richtigen Gruppen in fester Reihenfolge", () => {
    const groups = groupTodos(
      [
        vm({ id: "over", dueKey: "2026-07-28" }),
        vm({ id: "today", dueKey: "2026-07-30" }),
        vm({ id: "week", dueKey: "2026-08-03" }),
        vm({ id: "later", dueKey: "2026-09-05" }),
        vm({ id: "none" }),
        vm({ id: "done", done: true, dueKey: "2026-07-30" }),
      ],
      NOW,
    );
    expect(groups.map((g) => g.key)).toEqual(["ueberfaellig", "heute", "woche", "spaeter", "ohne", "erledigt"]);
    expect(groups.find((g) => g.key === "heute")!.todos[0].id).toBe("today");
  });

  it("lässt leere Gruppen weg", () => {
    const groups = groupTodos([vm({ id: "a", dueKey: "2026-07-30" })], NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("heute");
  });

  it("Grenze: genau +7 Tage zählt noch als diese Woche", () => {
    const groups = groupTodos([vm({ id: "edge", dueKey: "2026-08-06" })], NOW);
    expect(groups[0].key).toBe("woche");
  });
});

describe("Fach Irgendwann", () => {
  it("heißt Irgendwann, nicht Ohne Termin", () => {
    const g = groupTodos([vm({ id: "1" })], NOW);
    expect(g.find((x) => x.key === "ohne")?.label).toBe("Irgendwann");
  });

  it("stellt Wichtiges im Parkplatz nach oben", () => {
    const g = groupTodos(
      [vm({ id: "egal", title: "Beiläufig" }), vm({ id: "wichtig", title: "Zählt", important: true })],
      NOW,
    );
    const ohne = g.find((x) => x.key === "ohne")!;
    expect(ohne.todos.map((t) => t.id)).toEqual(["wichtig", "egal"]);
  });

  it("sortiert datierte Fächer nicht nach Wichtigkeit um", () => {
    const g = groupTodos(
      [
        vm({ id: "a", dueKey: "2026-07-30" }),
        vm({ id: "b", dueKey: "2026-07-30", important: true }),
      ],
      NOW,
    );
    // Bei datierten Aufgaben zählt das Datum, nicht ein Kennzeichen.
    expect(g.find((x) => x.key === "heute")!.todos.map((t) => t.id)).toEqual(["a", "b"]);
  });
});
