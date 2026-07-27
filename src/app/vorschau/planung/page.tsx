import { PlanungClient } from "@/app/planung/PlanungClient";

export const dynamic = "force-dynamic";

/** Öffentliche Vorschau der Wochenplanung (Beispieldaten), ohne Login/DB/KI. */
export default function VorschauPlanung() {
  return (
    <PlanungClient
      configured={false}
      fairnessLabel="Gut verteilt — Constanze und Dirk etwa gleich oft."
      careGapCount={2}
      patterns={[
        { id: "1", label: "Sonntags ist Familienzeit", isActive: true, source: "manuell" },
        { id: "2", label: "Constanze macht lieber die Vormittage", isActive: true, source: "gelernt" },
        { id: "3", label: "Kein Sport am Wochenende", isActive: false, source: "manuell" },
      ]}
    />
  );
}
