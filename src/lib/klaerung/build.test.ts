import { describe, it, expect } from "vitest";
import {
  buildStack,
  shouldShowStack,
  markShown,
  markLater,
  shiftLabel,
  EMPTY_STATE,
  MAX_KARTEN,
  type KlaerungCard,
} from "./build";

const aufgabe = (id: string, extra: Partial<Extract<KlaerungCard, { kind: "aufgabe" }>> = {}) =>
  ({ kind: "aufgabe", id, title: "A", dueLabel: null, overdue: false, shiftCount: 0, ...extra }) as Extract<
    KlaerungCard,
    { kind: "aufgabe" }
  >;
const betreuung = (uid: string) =>
  ({ kind: "betreuung", uid, title: "B", when: "heute", occurrenceISO: "2026-07-31T08:00:00.000Z" }) as Extract<
    KlaerungCard,
    { kind: "betreuung" }
  >;

describe("buildStack", () => {
  it("sortiert nach Dringlichkeit: Eskalation, Anfrage, Betreuung, Aufgaben", () => {
    const stack = buildStack({
      eskalationen: [{ kind: "eskalation", uid: "e", title: "E", when: "heute", occurrenceISO: null }],
      anfragen: [{ kind: "anfrage", id: "q", question: "F?", fromName: "Constanze", eventUid: null }],
      betreuung: [betreuung("b")],
      aufgaben: [aufgabe("t")],
    });
    expect(stack.map((c) => c.kind)).toEqual(["eskalation", "anfrage", "betreuung", "aufgabe"]);
  });

  it("überfällige Aufgaben vor normalen", () => {
    const stack = buildStack({
      eskalationen: [],
      anfragen: [],
      betreuung: [],
      aufgaben: [aufgabe("neu"), aufgabe("alt", { overdue: true })],
    });
    expect(stack.map((c) => (c.kind === "aufgabe" ? c.id : ""))).toEqual(["alt", "neu"]);
  });

  it("deckelt hart bei 5 Karten", () => {
    const stack = buildStack({
      eskalationen: [],
      anfragen: [],
      betreuung: [betreuung("b1"), betreuung("b2"), betreuung("b3")],
      aufgaben: [aufgabe("t1"), aufgabe("t2"), aufgabe("t3")],
    });
    expect(stack).toHaveLength(MAX_KARTEN);
    // Betreuung geht vor — die letzte Aufgabe fällt raus.
    expect(stack.filter((c) => c.kind === "betreuung")).toHaveLength(3);
  });
});

describe("shouldShowStack", () => {
  const now = new Date("2026-07-31T10:00:00Z");
  const heute = "2026-07-31";

  it("zeigt bei Karten und leerem Zustand", () => {
    expect(shouldShowStack(2, EMPTY_STATE, now, heute)).toBe(true);
  });

  it("zeigt nie ohne Karten", () => {
    expect(shouldShowStack(0, EMPTY_STATE, now, heute)).toBe(false);
  });

  it("Später unterdrückt für drei Stunden — danach wieder da", () => {
    const state = markLater(EMPTY_STATE, now);
    expect(shouldShowStack(2, state, new Date("2026-07-31T12:59:00Z"), heute)).toBe(false);
    expect(shouldShowStack(2, state, new Date("2026-07-31T13:01:00Z"), heute)).toBe(true);
  });

  it("höchstens zweimal am Tag", () => {
    let state = markShown(EMPTY_STATE, heute);
    expect(shouldShowStack(2, state, now, heute)).toBe(true);
    state = markShown(state, heute);
    expect(shouldShowStack(2, state, now, heute)).toBe(false);
  });

  it("am nächsten Tag zählt es von vorn", () => {
    let state = markShown(EMPTY_STATE, heute);
    state = markShown(state, heute);
    expect(shouldShowStack(2, state, now, "2026-08-01")).toBe(true);
  });
});

describe("shiftLabel", () => {
  it("schweigt bei 0 und 1 Verschiebungen", () => {
    expect(shiftLabel(0)).toBeNull();
    expect(shiftLabel(1)).toBeNull();
  });

  it("wird ab der dritten Verschiebung ehrlich", () => {
    expect(shiftLabel(2)).toBe("zum 3. Mal verschoben");
    expect(shiftLabel(4)).toBe("zum 5. Mal verschoben");
  });
});

describe("Sonntags-Parkplatz", () => {
  const parken = (id: string, important = false) =>
    ({ kind: "parken", id, title: "Kinderwagen putzen", important }) as Extract<
      KlaerungCard,
      { kind: "parken" }
    >;

  it("steht hinter allem, was heute ansteht", () => {
    const stack = buildStack({
      eskalationen: [],
      anfragen: [],
      betreuung: [],
      aufgaben: [aufgabe("heute")],
      parken: [parken("p1")],
    });
    expect(stack.map((c) => c.kind)).toEqual(["aufgabe", "parken"]);
  });

  it("wichtige Geparkte zuerst", () => {
    const stack = buildStack({
      eskalationen: [],
      anfragen: [],
      betreuung: [],
      aufgaben: [],
      parken: [parken("egal"), parken("wichtig", true)],
    });
    expect(stack.map((c) => (c.kind === "parken" ? c.id : ""))).toEqual(["wichtig", "egal"]);
  });

  it("verdraengt nie das Dringende aus dem Deckel", () => {
    const stack = buildStack({
      eskalationen: [],
      anfragen: [],
      betreuung: [],
      aufgaben: [aufgabe("a"), aufgabe("b"), aufgabe("c"), aufgabe("d"), aufgabe("e")],
      parken: [parken("p1"), parken("p2")],
    });
    expect(stack).toHaveLength(MAX_KARTEN);
    expect(stack.every((c) => c.kind === "aufgabe")).toBe(true);
  });

  it("ohne Sonntag bleibt der Stapel unveraendert", () => {
    const stack = buildStack({ eskalationen: [], anfragen: [], betreuung: [], aufgaben: [aufgabe("x")] });
    expect(stack.map((c) => c.kind)).toEqual(["aufgabe"]);
  });
});
