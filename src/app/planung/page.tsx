import { auth } from "@/auth";
import { aiConfigured } from "@/lib/ai/client";
import { buildContextFromDb } from "@/lib/ai/weekly-plan-runner";
import { getFairness } from "@/lib/fairness/repository";
import { listPatterns } from "@/lib/patterns/repository";
import { PlanungClient } from "./PlanungClient";

export const dynamic = "force-dynamic";

/** KI-Wochenplanung (Sonntag): Überblick, Vorschläge, Fairness, Vorlieben (Abschnitt 6.4). */
export default async function PlanungPage() {
  const session = await auth();
  const now = new Date();

  const ctx = await buildContextFromDb(session?.user?.id ?? null, now);
  const fairness = await getFairness(6, now);
  const patterns = await listPatterns();

  return (
    <PlanungClient
      configured={aiConfigured()}
      fairnessLabel={fairness.label}
      careGapCount={ctx.careGaps.length}
      patterns={patterns}
    />
  );
}
