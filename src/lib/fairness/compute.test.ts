import { describe, it, expect } from "vitest";
import { computeFairness } from "./compute";

describe("computeFairness", () => {
  it("leer → nichts erfasst", () => {
    const f = computeFairness([]);
    expect(f.assigned).toBe(0);
    expect(f.leaning).toBe("balanced");
    expect(f.label).toMatch(/Noch keine/);
  });

  it("zählt je Person und offene", () => {
    const f = computeFairness([
      { person: "constanze" },
      { person: "dirk" },
      { person: null },
    ]);
    expect(f.constanze).toBe(1);
    expect(f.dirk).toBe(1);
    expect(f.open).toBe(1);
    expect(f.assigned).toBe(2);
  });

  it("gleichmäßig → balanced, Constanze zuerst genannt", () => {
    const f = computeFairness([
      { person: "constanze" },
      { person: "constanze" },
      { person: "dirk" },
      { person: "dirk" },
    ]);
    expect(f.leaning).toBe("balanced");
    expect(f.label).toMatch(/Constanze und Dirk/);
  });

  it("Constanze deutlich mehr → leaning constanze", () => {
    const f = computeFairness([
      { person: "constanze" },
      { person: "constanze" },
      { person: "constanze" },
      { person: "dirk" },
    ]);
    expect(f.leaning).toBe("constanze");
    expect(f.constanzeShare).toBeCloseTo(0.75);
    expect(f.label).toMatch(/Constanze hat zuletzt öfter/);
  });

  it("Dirk deutlich mehr → leaning dirk", () => {
    const f = computeFairness([
      { person: "dirk" },
      { person: "dirk" },
      { person: "dirk" },
      { person: "constanze" },
    ]);
    expect(f.leaning).toBe("dirk");
    expect(f.label).toMatch(/Dirk hat zuletzt öfter/);
  });

  it("kleine Stichprobe (1) bleibt balanced", () => {
    const f = computeFairness([{ person: "constanze" }]);
    expect(f.leaning).toBe("balanced");
  });
});
