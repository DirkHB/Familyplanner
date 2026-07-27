/**
 * Einfacher In-Memory-Rate-Limiter (fixes Fenster). Für einen 2-Personen-Dienst
 * auf einer App-Instanz völlig ausreichend und ohne externe Abhängigkeit.
 * Schützt v. a. kostenverursachende KI-Aktionen und den Magic-Link-Versand.
 *
 * Hinweis: Bei mehreren Instanzen gilt das Limit pro Instanz. Für dieses Projekt
 * (Single-App-Service auf Sliplane) ist das bewusst gewählt und dokumentiert.
 * Die reine Logik ist mit injizierbarer Zeit unit-testbar.
 */

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

export type RateResult = { ok: boolean; remaining: number; retryAfterMs: number };

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateResult {
  const b = store.get(key);
  if (!b || now >= b.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: b.resetAt - now };
  }
  b.count += 1;
  return { ok: true, remaining: limit - b.count, retryAfterMs: 0 };
}

/** Nur für Tests: Zustand leeren. */
export function __resetRateLimit() {
  store.clear();
}

/** Bequeme Vorgaben. */
export const LIMITS = {
  aiCapture: { limit: 30, windowMs: 60 * 60_000 }, // 30/h Schnellerfassung
  aiPlan: { limit: 15, windowMs: 60 * 60_000 }, // 15/h Wochenplanung
  aiPrep: { limit: 40, windowMs: 60 * 60_000 }, // 40/h Checklisten-Vorschläge
  magicLink: { limit: 5, windowMs: 15 * 60_000 }, // 5 / 15 min pro E-Mail
  pushSubscribe: { limit: 20, windowMs: 60 * 60_000 },
} as const;
