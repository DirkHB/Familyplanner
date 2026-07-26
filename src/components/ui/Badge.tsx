import type { ReactNode } from "react";

type Tone = "geklaert" | "offen" | "da" | "neutral";

const TONE: Record<Tone, string> = {
  // Türkis-hell für Geklärtes
  geklaert: "bg-[var(--color-accent-light)] text-[var(--color-ink)]",
  // Rosé für Offenes — warm, kein Alarm
  offen: "bg-[var(--color-counter-light)] text-[var(--color-signal)]",
  da: "bg-[var(--color-accent-light)] text-[var(--color-ink)]",
  neutral: "bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-medium ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}
