/**
 * Kontextaufbau für die KI-Wochenplanung (Abschnitt 6.4): fasst Woche, offene
 * Anfragen, Betreuungslücken, Fairness-Blick und gelernte Muster zu einem kompakten
 * Prompt-Text zusammen. Reine Funktionen → unit-testbar, kein Netz, keine DB.
 */

export type PlanningContext = {
  todayLabel: string;
  week: { day: string; events: string[] }[];
  careGaps: string[];
  openRequests: string[];
  fairness: string;
  patterns: string[];
};

export type ContextDay = {
  weekday: string;
  dayNumber: string;
  events: {
    time: string;
    title: string;
    categoryLabel: string;
    care: { status: "geklaert" | "offen" | "da"; label: string } | null;
  }[];
};

export function buildPlanningContext(input: {
  todayLabel: string;
  days: ContextDay[];
  openRequests: string[];
  fairnessLabel: string;
  patterns: string[];
}): PlanningContext {
  const week = input.days.map((d) => ({
    day: `${d.weekday}, ${d.dayNumber}.`,
    events: d.events.map((e) => {
      const when = e.time ? e.time : "ganztägig";
      const care = e.care ? ` [${e.care.label}]` : "";
      return `${when} · ${e.title} (${e.categoryLabel})${care}`;
    }),
  }));

  const careGaps: string[] = [];
  for (const d of input.days) {
    for (const e of d.events) {
      if (e.care?.status === "offen") {
        careGaps.push(`${d.weekday}: ${e.title}${e.time ? ` um ${e.time}` : ""}`);
      }
    }
  }

  return {
    todayLabel: input.todayLabel,
    week,
    careGaps,
    openRequests: input.openRequests,
    fairness: input.fairnessLabel,
    patterns: input.patterns,
  };
}

/** Kompakter, deterministischer Prompt-Text (kein JSON) für das Modell. */
export function renderPlanningPrompt(ctx: PlanningContext): string {
  const lines: string[] = [];
  lines.push(`Heute ist ${ctx.todayLabel}. Hier die kommende Woche von Constanze und Dirk.`);
  lines.push("");
  lines.push("## Termine");
  if (ctx.week.every((d) => d.events.length === 0)) {
    lines.push("(keine Termine erfasst)");
  } else {
    for (const d of ctx.week) {
      lines.push(`### ${d.day}`);
      if (d.events.length === 0) lines.push("- frei");
      else for (const e of d.events) lines.push(`- ${e}`);
    }
  }
  lines.push("");
  lines.push("## Betreuung offen");
  lines.push(ctx.careGaps.length ? ctx.careGaps.map((g) => `- ${g}`).join("\n") : "- keine offenen Punkte");
  lines.push("");
  lines.push("## Offene Anfragen");
  lines.push(ctx.openRequests.length ? ctx.openRequests.map((r) => `- ${r}`).join("\n") : "- keine");
  lines.push("");
  lines.push("## Fairness-Blick");
  lines.push(ctx.fairness);
  if (ctx.patterns.length) {
    lines.push("");
    lines.push("## Bekannte Muster/Vorlieben");
    lines.push(ctx.patterns.map((p) => `- ${p}`).join("\n"));
  }
  return lines.join("\n");
}
