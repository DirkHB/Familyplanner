import { getOverview } from "@/lib/overview/repository";
import { briefingText } from "@/lib/overview/build";
import { defaultHorizon, horizonRange, type Horizon } from "@/lib/overview/horizon";
import { formatMonthDay } from "@/lib/calendar/format";
import { UeberblickClient } from "./UeberblickClient";

export const dynamic = "force-dynamic";

/**
 * Überblick: zeigt nur, was noch kommt — ab jetzt bis Sonntagabend.
 * Ab Sonntag 12:00 automatisch die komplette nächste Woche.
 */
export default async function UeberblickPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string; frage?: string }>;
}) {
  const { n, frage } = await searchParams;
  const now = new Date();
  const auto = defaultHorizon(now);
  // ?n=1 blättert bewusst auf die nächste Woche (sonst gilt die Automatik).
  const kind: Horizon = n === "1" ? "naechste-woche" : auto;
  const showingNext = kind === "naechste-woche";

  const overview = await getOverview(kind, now);
  // Briefing-Zeile immer live rechnen: Die um 7:00 gespeicherte Fassung (für
  // den Push) veraltet über den Tag — "1× Betreuung offen" stand sonst noch
  // abends da, obwohl längst geklärt. Gleiche Textform, aktueller Stand.
  const briefing = briefingText(overview, showingNext ? "woche" : "morgen");

  const { from, to } = horizonRange(kind, now);
  const lastDay = new Date(to.getTime() - 86_400_000);
  const scopeLabel = showingNext
    ? `Nächste Woche · ${formatMonthDay(from)} – ${formatMonthDay(lastDay)}`
    : `Ab jetzt bis Sonntag, ${formatMonthDay(lastDay)}`;

  // Die offene Frage steht in der Adresse, damit sie beim Zurückkommen aus
  // einem Termin noch gilt. Als reiner React-Zustand ging sie verloren: Die
  // Seite wird neu aufgebaut und stand wieder auf der ersten Frage.
  const initialTab = frage === "offen" ? "offen" : "woche";
  const frageQuery = initialTab === "offen" ? "frage=offen" : "";
  const mitFrage = (basis: string) =>
    frageQuery ? `${basis}${basis.includes("?") ? "&" : "?"}${frageQuery}` : basis;

  return (
    <UeberblickClient
      overview={overview}
      scopeLabel={scopeLabel}
      briefing={briefing}
      initialTab={initialTab}
      // Wenn die Automatik schon auf „nächste Woche" steht, gibt es nichts umzuschalten.
      otherHref={mitFrage(showingNext ? "/ueberblick" : "/ueberblick?n=1")}
      otherLabel={showingNext ? "Aktuell" : "Nächste Woche"}
      showToggle={!(auto === "naechste-woche" && showingNext)}
    />
  );
}
