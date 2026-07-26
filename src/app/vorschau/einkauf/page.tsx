import { EinkaufClient } from "@/app/einkauf/EinkaufClient";

export const dynamic = "force-dynamic";

/** Öffentliche Vorschau der Einkaufsliste (Beispieldaten), ohne Login/DB. */
export default function VorschauEinkauf() {
  const groups = [
    {
      category: "frisches",
      label: "Frisches",
      items: [
        { id: "1", text: "Bananen", checked: true, addedByPerson: "dirk" as const },
        { id: "2", text: "Haferdrink", checked: true, addedByPerson: "dirk" as const },
      ],
    },
    {
      category: "baby",
      label: "Baby",
      items: [{ id: "3", text: "Windeln Größe 2", checked: false, addedByPerson: "constanze" as const }],
    },
    {
      category: "haushalt",
      label: "Haushalt",
      items: [
        { id: "4", text: "Spülmaschinentabs", checked: false, addedByPerson: "dirk" as const },
        { id: "5", text: "Kaffeebohnen", checked: false, addedByPerson: "dirk" as const },
      ],
    },
  ];
  return <EinkaufClient groups={groups} partnerName="Constanze" partnerPerson="constanze" />;
}
