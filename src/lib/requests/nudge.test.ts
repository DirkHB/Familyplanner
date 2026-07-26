import { describe, it, expect } from "vitest";
import { evaluateNudge, isOverdue, ageInDays } from "./nudge";

const now = new Date("2026-07-27T09:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe("nudge/eskalation", () => {
  it("beantwortete Anfragen lösen nichts aus", () => {
    const d = evaluateNudge({ status: "answered", createdAt: daysAgo(5), lastNudgeAt: null }, now);
    expect(d.shouldPushToday).toBe(false);
    expect(d.shouldEmail).toBe(false);
    expect(d.overdue).toBe(false);
  });

  it("offene Anfrage ohne Nudge heute → Push", () => {
    const d = evaluateNudge({ status: "open", createdAt: daysAgo(1), lastNudgeAt: null }, now);
    expect(d.shouldPushToday).toBe(true);
    expect(d.shouldEmail).toBe(false);
  });

  it("nicht zweimal am selben Tag pushen", () => {
    const earlierToday = new Date("2026-07-27T06:00:00Z");
    const d = evaluateNudge({ status: "open", createdAt: daysAgo(1), lastNudgeAt: earlierToday }, now);
    expect(d.shouldPushToday).toBe(false);
  });

  it("ab 3 Tagen zusätzlich E-Mail", () => {
    const d = evaluateNudge({ status: "open", createdAt: daysAgo(3), lastNudgeAt: daysAgo(1) }, now);
    expect(d.shouldEmail).toBe(true);
  });

  it("ab 7 Tagen overdue (rot)", () => {
    expect(evaluateNudge({ status: "open", createdAt: daysAgo(7), lastNudgeAt: null }, now).overdue).toBe(true);
    expect(evaluateNudge({ status: "open", createdAt: daysAgo(6), lastNudgeAt: null }, now).overdue).toBe(false);
  });

  it("isOverdue nur für offene", () => {
    expect(isOverdue(daysAgo(8), "open", now)).toBe(true);
    expect(isOverdue(daysAgo(8), "answered", now)).toBe(false);
  });

  it("ageInDays rechnet ganze Tage", () => {
    expect(ageInDays(daysAgo(2), now)).toBe(2);
  });
});
