/** Monatsraster (Termine-Tab): reine Kalender-Mathematik, testbar, TZ-frei —
 *  gerechnet auf Kalenderdaten (YYYY-MM-DD), nicht auf Instants. */

export type MonthCell = { key: string; day: number; inMonth: boolean };

const titleFmt = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function isMonthKey(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function monthTitle(monthKey: string): string {
  return titleFmt.format(new Date(`${monthKey}-01T00:00:00Z`));
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

function keyOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Wochenzeilen (Mo–So) für den Monat; Randzellen aus Nachbar-Monaten inklusive. */
export function buildMonthMatrix(monthKey: string): MonthCell[][] {
  const [y, m] = monthKey.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7; // 0 = Montag
  const start = new Date(Date.UTC(y, m - 1, 1 - mondayOffset));

  const weeks: MonthCell[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < 6; w++) {
    const row: MonthCell[] = [];
    for (let i = 0; i < 7; i++) {
      row.push({
        key: keyOf(cursor),
        day: cursor.getUTCDate(),
        inMonth: cursor.getUTCMonth() === m - 1,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(row);
    // Stopp, sobald die nächste Zeile komplett im Folgemonat läge.
    if (cursor.getUTCMonth() !== m - 1) break;
  }
  return weeks;
}
