import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, __resetRateLimit } from "./rate-limit";

beforeEach(() => __resetRateLimit());

describe("rateLimit", () => {
  it("erlaubt bis zum Limit, dann blockt", () => {
    const t0 = 1_000_000;
    expect(rateLimit("a", 3, 1000, t0).ok).toBe(true);
    expect(rateLimit("a", 3, 1000, t0).ok).toBe(true);
    const third = rateLimit("a", 3, 1000, t0);
    expect(third.ok).toBe(true);
    expect(third.remaining).toBe(0);
    const fourth = rateLimit("a", 3, 1000, t0);
    expect(fourth.ok).toBe(false);
    expect(fourth.retryAfterMs).toBeGreaterThan(0);
  });

  it("setzt nach Ablauf des Fensters zurück", () => {
    const t0 = 2_000_000;
    rateLimit("b", 1, 1000, t0);
    expect(rateLimit("b", 1, 1000, t0).ok).toBe(false);
    expect(rateLimit("b", 1, 1000, t0 + 1001).ok).toBe(true);
  });

  it("trennt Schlüssel voneinander", () => {
    const t0 = 3_000_000;
    rateLimit("x", 1, 1000, t0);
    expect(rateLimit("y", 1, 1000, t0).ok).toBe(true);
  });
});
