import { EinkaufClient } from "@/app/einkauf/EinkaufClient";


export const dynamic = "force-dynamic";

/** Öffentliche Vorschau der Einkaufsliste (Beispieldaten), ohne Login/DB. */
export default function VorschauEinkauf() {
  const groups: { category: string; label: string; items: { id: string; text: string; checked: boolean; addedByPerson: "dirk" | "constanze" }[] }[] = [
    {
      category: "lidl",
      label: "Lidl",
      items: [
        { id: "1", text: "Bananen", checked: true, addedByPerson: "dirk" },
        { id: "2", text: "Haferdrink", checked: false, addedByPerson: "dirk" },
      ],
    },
    {
      category: "ali",
      label: "Ali",
      items: [{ id: "3", text: "Fladenbrot", checked: false, addedByPerson: "constanze" }],
    },
    {
      category: "edeka",
      label: "Edeka",
      items: [{ id: "4", text: "Windeln Größe 2", checked: false, addedByPerson: "constanze" }],
    },
    { category: "kaefer", label: "Käfer", items: [] },
    {
      category: "sonstiges",
      label: "Sonstiges",
      items: [{ id: "5", text: "Spülmaschinentabs", checked: false, addedByPerson: "dirk" }],
    },
  ];
  return <EinkaufClient groups={groups} partnerName="Constanze" />;
}
