import { describe, it, expect } from "vitest";
import { buildMonthMatrix, shiftMonth, monthTitle, isMonthKey } from "./month";

describe("buildMonthMatrix", () => {
  it("August 2026 beginnt Mo 27.07. und enthält den 01.08. an Position Sa", () => {
    const weeks = buildMonthMatrix("2026-08");
    expect(weeks[0][0].key).toBe("2026-07-27");
    expect(weeks[0][0].inMonth).toBe(false);
    expect(weeks[0][5]).toMatchObject({ key: "2026-08-01", inMonth: true });
    // 31. August ist ein Montag → letzte Zeile beginnt mit ihm.
    const last = weeks[weeks.length - 1];
    expect(last[0].key).toBe("2026-08-31");
    expect(last[6].inMonth).toBe(false);
  });

  it("Februar 2027 (28 Tage, beginnt Mo) hat exakt 4 Zeilen ohne Randzellen", () => {
    const weeks = buildMonthMatrix("2027-02");
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toMatchObject({ key: "2027-02-01", inMonth: true });
    expect(weeks[3][6]).toMatchObject({ key: "2027-02-28", inMonth: true });
  });
});

describe("shiftMonth", () => {
  it("rollt über Jahresgrenzen", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-08", 1)).toBe("2026-09");
  });
});

describe("monthTitle / isMonthKey", () => {
  it("formatiert deutsch und validiert Keys", () => {
    expect(monthTitle("2026-09")).toBe("September 2026");
    expect(isMonthKey("2026-09")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("x")).toBe(false);
  });
});
