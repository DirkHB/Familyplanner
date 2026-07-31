/**
 * Klärung — der Kartenstapel beim Öffnen der App.
 *
 * Eine Entscheidung pro Karte, einhändig wischbar. Die Forschung dazu ist
 * eindeutig: Vollbild-Unterbrechungen funktionieren nur, wenn sie das zeigen,
 * wofür man ohnehin da ist, leicht wegzudrücken sind und selten bleiben.
 * Deshalb die harten Regeln:
 *   - höchstens 5 Karten (lieber fünf entschiedene als zwanzig weggewischte)
 *   - nur wenn es wirklich etwas zu entscheiden gibt
 *   - „Später" hält 3 Stunden, und der Stapel erscheint höchstens 2× am Tag
 *   - niemals über einen Direkteinstieg legen (Push-Klick führt zum Ziel)
 *
 * Reine Logik ohne Datenbank, damit alles testbar ist.
 */

export const MAX_KARTEN = 5;
export const SPAETER_STUNDEN = 3;
export const MAX_ANZEIGEN_PRO_TAG = 2;

export type KlaerungCard =
  | {
      kind: "eskalation";
      uid: string;
      title: string;
      when: string;
      occurrenceISO: string | null;
    }
  | { kind: "anfrage"; id: string; question: string; fromName: string; eventUid: string | null }
  | { kind: "betreuung"; uid: string; title: string; when: string; occurrenceISO: string }
  | {
      kind: "aufgabe";
      id: string;
      title: string;
      dueLabel: string | null;
      overdue: boolean;
      shiftCount: number;
    };

/**
 * Stapel zusammenstellen. Reihenfolge nach Dringlichkeit:
 * Eskalationen (ihr könnt beide nicht) → Anfragen an mich → unbesprochene
 * Betreuung → Aufgaben (überfällige zuerst). Dann harter Deckel.
 */
export function buildStack(input: {
  eskalationen: Extract<KlaerungCard, { kind: "eskalation" }>[];
  anfragen: Extract<KlaerungCard, { kind: "anfrage" }>[];
  betreuung: Extract<KlaerungCard, { kind: "betreuung" }>[];
  aufgaben: Extract<KlaerungCard, { kind: "aufgabe" }>[];
}): KlaerungCard[] {
  const aufgaben = [...input.aufgaben].sort((a, b) => Number(b.overdue) - Number(a.overdue));
  return [...input.eskalationen, ...input.anfragen, ...input.betreuung, ...aufgaben].slice(
    0,
    MAX_KARTEN,
  );
}

/** Client-seitiger Zustand der Unterdrückung (liegt im localStorage). */
export type StackState = {
  /** ISO-Zeitpunkt, bis zu dem „Später" gilt. */
  suppressedUntil: string | null;
  /** Tag (YYYY-MM-DD Berlin) der letzten Anzeigen … */
  shownDay: string | null;
  /** … und wie oft der Stapel an diesem Tag schon erschienen ist. */
  shownCount: number;
};

export const EMPTY_STATE: StackState = { suppressedUntil: null, shownDay: null, shownCount: 0 };

/**
 * Erscheint der Stapel jetzt? Nur wenn es Karten gibt, „Später" abgelaufen
 * ist und er heute noch nicht zweimal zu sehen war.
 */
export function shouldShowStack(
  cardCount: number,
  state: StackState,
  now: Date,
  todayKey: string,
): boolean {
  if (cardCount === 0) return false;
  if (state.suppressedUntil && new Date(state.suppressedUntil) > now) return false;
  if (state.shownDay === todayKey && state.shownCount >= MAX_ANZEIGEN_PRO_TAG) return false;
  return true;
}

/** Zustand nach einer Anzeige des Stapels. */
export function markShown(state: StackState, todayKey: string): StackState {
  const count = state.shownDay === todayKey ? state.shownCount + 1 : 1;
  return { ...state, shownDay: todayKey, shownCount: count };
}

/** Zustand nach „Später". */
export function markLater(state: StackState, now: Date): StackState {
  return {
    ...state,
    suppressedUntil: new Date(now.getTime() + SPAETER_STUNDEN * 3_600_000).toISOString(),
  };
}

/** Beschriftung des Verschiebe-Zählers — ehrlich, aber ohne Vorwurf. */
export function shiftLabel(shiftCount: number): string | null {
  return shiftCount >= 2 ? `zum ${shiftCount + 1}. Mal verschoben` : null;
}
