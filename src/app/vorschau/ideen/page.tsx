import { IdeenClient } from "@/app/ideen/IdeenClient";
import type { IdeaVM } from "@/lib/ideas/repository";

export const dynamic = "force-dynamic";

/** Öffentliche Vorschau des Ideen- & Urlaubsboards (Beispieldaten), ohne Login/DB. */
export default function VorschauIdeen() {
  const ideas: IdeaVM[] = [
    {
      id: "1",
      type: "urlaub",
      title: "Wochenende Tegernsee",
      description: "Kleine Hütte mit Blick, kinderwagentauglich",
      imageUrl: null,
      targetPeriod: "Ende September",
      votes: { dirk: true, constanze: true },
      status: "offen",
    },
    {
      id: "2",
      type: "ausflug",
      title: "Botanischer Garten",
      description: "Sonntagvormittag, wenn's warm ist",
      imageUrl: null,
      targetPeriod: "im Frühling",
      votes: { dirk: false, constanze: true },
      status: "offen",
    },
    {
      id: "3",
      type: "restaurant",
      title: "Das kleine Italienische",
      description: "Endlich mal wieder zu zweit essen",
      imageUrl: null,
      targetPeriod: null,
      votes: { dirk: true, constanze: false },
      status: "offen",
    },
  ];
  return <IdeenClient ideas={ideas} />;
}
