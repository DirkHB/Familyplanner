import { EinrichtenClient } from "@/app/einrichten/EinrichtenClient";
import type { EinrichtungStatus } from "@/lib/haushalt/einrichtung";

export const dynamic = "force-dynamic";

/**
 * Öffentliche Vorschau des Einrichtungs-Assistenten — im Zustand eines
 * frischen Haushalts, also mit allen fünf Schritten offen. Das Speichern
 * scheitert ohne Anmeldung; hier zählt der Weg durch die Schritte.
 */
const STATUS: EinrichtungStatus = {
  abgeschlossen: false,
  erledigt: { namen: false, kalender: false, partner: false, aufgaben: false, faecher: false },
  offen: ["namen", "kalender", "partner", "aufgaben", "faecher"],
  partnerEmail: "yvonne@example.com",
  partnerDa: false,
  eingeladenEmail: null,
  kind: "das Baby",
  // Leer, damit sich die Vorschau ohne Anmeldung durchklicken lässt — der
  // Fuß speichert nur, wenn wirklich etwas eingetragen wurde.
  erwachsene: [
    { email: "thomas@example.com", name: "" },
    { email: "yvonne@example.com", name: "" },
  ],
};

export default function VorschauEinrichten() {
  return <EinrichtenClient status={STATUS} meineEmail="thomas@example.com" />;
}
