"use client";

import { useEffect, useState } from "react";
import type { KlaerungCard } from "@/lib/klaerung/build";
import {
  shouldShowStack,
  markShown,
  markLater,
  EMPTY_STATE,
  type StackState,
} from "@/lib/klaerung/build";
import { KlaerungStack } from "./KlaerungStack";

/**
 * Entscheidet, ob der Stapel jetzt erscheint. Liegt nur auf der Woche —
 * ein Direkteinstieg (Push-Klick auf Termin oder Überblick) wird nie gekapert;
 * genau daran sterben Vollbild-Unterbrechungen sonst.
 */

const KEY = "klaerung:v1";

function readState(): StackState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_STATE;
    const p = JSON.parse(raw) as Partial<StackState>;
    return {
      suppressedUntil: typeof p.suppressedUntil === "string" ? p.suppressedUntil : null,
      shownDay: typeof p.shownDay === "string" ? p.shownDay : null,
      shownCount: typeof p.shownCount === "number" ? p.shownCount : 0,
    };
  } catch {
    return EMPTY_STATE;
  }
}

function writeState(s: StackState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* privater Modus — dann eben ohne Gedächtnis */
  }
}

export function KlaerungGate({ cards, todayKey }: { cards: KlaerungCard[]; todayKey: string }) {
  const [visible, setVisible] = useState(false);

  // Bewusst erst nach dem ersten Rendern entscheiden: localStorage gibt es
  // nur im Browser, und die Woche darunter ist sofort da, falls nichts kommt.
  useEffect(() => {
    if (cards.length === 0) return;
    const state = readState();
    if (shouldShowStack(cards.length, state, new Date(), todayKey)) {
      writeState(markShown(state, todayKey));
      setVisible(true);
    }
  }, [cards.length, todayKey]);

  if (!visible) return null;
  return (
    <KlaerungStack
      cards={cards}
      onClose={() => {
        writeState(markLater(readState(), new Date()));
        setVisible(false);
      }}
    />
  );
}
