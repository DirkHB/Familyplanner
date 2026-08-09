"use client";

import { useName } from "@/components/app/HaushaltContext";
import { PLATZ_A, type Platz } from "@/lib/haushalt/platz";

/**
 * Der Personen-Kreis. Farbe trägt die Unterscheidung — Platz A dunkelblau,
 * Platz B rosé —, der Buchstabe kommt aus dem Namen.
 *
 * Bis eben standen „D" und „C" fest im Code. In einem zweiten Haushalt hätte
 * Yvonne ein „C" getragen. Steht noch kein Name fest, bleibt der Kreis leer:
 * ein falscher Buchstabe ist schlimmer als gar keiner, denn er behauptet
 * etwas.
 */

const FARBE: Record<Platz, { bg: string; fg: string }> = {
  [PLATZ_A]: { bg: "var(--color-ink)", fg: "var(--color-surface)" },
  constanze: { bg: "var(--color-counter)", fg: "var(--color-surface)" },
};

export function Avatar({
  person,
  size = 28,
  showName = false,
}: {
  person: Platz;
  size?: number;
  showName?: boolean;
}) {
  const name = useName(person);
  const { bg, fg } = FARBE[person] ?? FARBE[PLATZ_A];
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-flex items-center justify-center rounded-full font-semibold"
        style={{
          width: size,
          height: size,
          background: bg,
          color: fg,
          fontSize: size * 0.4,
        }}
        aria-hidden
      >
        {name.charAt(0).toUpperCase()}
      </span>
      {showName && name && <span className="font-medium">{name}</span>}
    </span>
  );
}
