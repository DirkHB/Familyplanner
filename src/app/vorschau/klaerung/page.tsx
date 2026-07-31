"use client";

import { useState } from "react";
import Link from "next/link";
import { KlaerungStack } from "@/components/klaerung/KlaerungStack";
import type { KlaerungCard } from "@/lib/klaerung/build";

/** Öffentliche Design-Vorschau des Klärungs-Stapels mit Beispieldaten. */
const CARDS: KlaerungCard[] = [
  { kind: "eskalation", uid: "e1", title: "Kinderarzt Nicolas | Impfung", when: "heute, 14:00", occurrenceISO: null },
  { kind: "anfrage", id: "q1", question: "Schaffst du Donnerstag den Einkauf?", fromName: "Constanze", eventUid: null },
  { kind: "betreuung", uid: "b1", title: "Zahnarzt", when: "morgen, 09:00", occurrenceISO: "2026-08-01T07:00:00.000Z" },
  { kind: "aufgabe", id: "t1", title: "Kindergeld-Antrag abschicken", dueLabel: "Fr, 31. Juli", overdue: true, shiftCount: 2 },
];

export default function VorschauKlaerung() {
  const [offen, setOffen] = useState(true);
  if (!offen)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg text-ink">
        <p className="text-ink-muted">Stapel geschlossen.</p>
        <button onClick={() => setOffen(true)} className="rounded-pill bg-accent px-5 py-3 font-medium text-surface">
          Nochmal zeigen
        </button>
        <Link href="/vorschau/woche" className="text-sm text-ink-muted underline">zur Woche</Link>
      </div>
    );
  return <KlaerungStack cards={CARDS} onClose={() => setOffen(false)} />;
}
