import { getOverview, getLatestBriefing } from "@/lib/overview/repository";
import { UeberblickClient } from "./UeberblickClient";

export const dynamic = "force-dynamic";

/** Überblick: die drei Fragen — Woche, Offenes, Verteilung. */
export default async function UeberblickPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>;
}) {
  const { n } = await searchParams;
  const next = n === "1";

  const overview = await getOverview(next ? "naechste-woche" : "heute-bis-sonntag");
  const briefing = await getLatestBriefing(next ? "woche" : "morgen").catch(() => null);

  return (
    <UeberblickClient
      overview={overview}
      scopeLabel={next ? "Nächste Woche · Mo–So" : "Heute bis Sonntag"}
      briefing={briefing?.summary ?? null}
      otherHref={next ? "/ueberblick" : "/ueberblick?n=1"}
      otherLabel={next ? "Diese Woche" : "Nächste Woche"}
    />
  );
}
