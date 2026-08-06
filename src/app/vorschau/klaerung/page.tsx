"use client";

import { useState } from "react";
import Link from "next/link";
import { KlaerungStack } from "@/components/klaerung/KlaerungStack";
import type { KlaerungCard } from "@/lib/klaerung/build";

/** Öffentliche Design-Vorschau des Klärungs-Stapels mit Beispieldaten. */
const CARDS: KlaerungCard[] = [
  { kind: "eskalation", uid: "e1", title: "Kinderarzt Nicolas | Impfung", when: "heute, 14:00", occurrenceISO: null },
  {
    kind: "anfrage",
    id: "q1",
    question: "Kannst du bei „André Termin Constanze 16:00\" aufs Baby aufpassen?",
    fromName: "Constanze",
    eventUid: "e-andre",
    when: "morgen, 16:00",
  },
  // Bewusst der Kinderarzt: Hier ist Nicolas dabei, und die Karte muss einen
  // dritten Weg anbieten. Wer die Vorschau ansieht, soll genau das sehen.
  { kind: "betreuung", uid: "b1", title: "Kinderarzt · U3", when: "morgen, 09:00", occurrenceISO: "2026-08-01T07:00:00.000Z" },
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
  return (
    <KlaerungStack
      cards={CARDS}
      briefing="Heute noch 2 Termine — als Nächstes 14:00 Kinderarzt. Einmal ist die Betreuung noch offen."
      onClose={() => setOffen(false)}
    />
  );
}
