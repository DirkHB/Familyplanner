import type Anthropic from "@anthropic-ai/sdk";
import { renderPlanningPrompt, type PlanningContext } from "./planning-context";

/** KI-Wochenplanung (Sonntag): Kontext → Überblick + konkrete, freundliche Vorschläge. */

export type SuggestionKind = "betreuung" | "vorbereitung" | "fairness" | "freizeit" | "sonstiges";

export type PlanSuggestion = { kind: SuggestionKind; text: string };

export type WeeklyPlan = {
  summary: string;
  suggestions: PlanSuggestion[];
};

const KINDS: SuggestionKind[] = ["betreuung", "vorbereitung", "fairness", "freizeit", "sonstiges"];

export const WEEKLY_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: { type: "string", enum: KINDS },
          text: { type: "string" },
        },
        required: ["kind", "text"],
      },
    },
  },
  required: ["summary", "suggestions"],
} as const;

/** Defensiv: nie werfen, immer ein gültiges Objekt liefern. */
export function normalizeWeeklyPlan(raw: unknown): WeeklyPlan {
  const obj = (raw ?? {}) as { summary?: unknown; suggestions?: unknown };
  const list = Array.isArray(obj.suggestions) ? obj.suggestions : [];
  const suggestions: PlanSuggestion[] = [];
  for (const item of list) {
    const s = (item ?? {}) as Partial<PlanSuggestion>;
    if (!s.text) continue;
    const kind = KINDS.includes(s.kind as SuggestionKind) ? (s.kind as SuggestionKind) : "sonstiges";
    suggestions.push({ kind, text: String(s.text).slice(0, 400) });
  }
  return {
    summary: typeof obj.summary === "string" ? obj.summary.slice(0, 600) : "",
    suggestions: suggestions.slice(0, 8),
  };
}

const SYSTEM = `Du bist ein ruhiger, praktischer Familienplaner-Assistent für Constanze und Dirk,
ein Paar mit einem Neugeborenen. Sprich Deutsch, per „du", warm und knapp.
Nenne die beiden immer „Constanze und Dirk" (Constanze zuerst).

Aufgabe: Gib einen kurzen Wochenüberblick (1–2 Sätze) und danach wenige konkrete,
umsetzbare Vorschläge. Priorisiere offene Baby-Betreuung und nötige Vorbereitung.
Beim Fairness-Blick bleib rein beschreibend und freundlich — nie vorwurfsvoll.
Erfinde keine Termine, die nicht im Kontext stehen. Halte dich kurz.`;

export async function generateWeeklyPlan(
  client: Anthropic,
  model: string,
  ctx: PlanningContext,
): Promise<WeeklyPlan> {
  const params = {
    model,
    max_tokens: 1500,
    system: SYSTEM,
    thinking: { type: "disabled" },
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: WEEKLY_PLAN_SCHEMA },
    },
    messages: [{ role: "user", content: renderPlanningPrompt(ctx) }],
  } as unknown as Anthropic.MessageCreateParamsNonStreaming;

  const res = await client.messages.create(params);
  const block = res.content.find((b) => b.type === "text");
  const jsonText = block && block.type === "text" ? block.text : "{}";
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    parsed = {};
  }
  return normalizeWeeklyPlan(parsed);
}
