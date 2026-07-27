import type Anthropic from "@anthropic-ai/sdk";

/** KI-Vorschläge für Vorbereitungs-Checklisten je Termin (Abschnitt 6.3 + 6.4). */

export const PREP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: { type: "array", items: { type: "string" } },
  },
  required: ["items"],
} as const;

/** Defensiv: nie werfen, kurze, eindeutige Items, dedupliziert, max. 8. */
export function normalizePrep(raw: unknown): string[] {
  const obj = (raw ?? {}) as { items?: unknown };
  const list = Array.isArray(obj.items) ? obj.items : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of list) {
    const t = String(it ?? "").trim().slice(0, 120);
    const key = t.toLowerCase();
    if (!t || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= 8) break;
  }
  return out;
}

const SYSTEM = `Du hilfst Constanze und Dirk (Paar mit Neugeborenem), einen Termin vorzubereiten.
Gib eine kurze Checkliste mit konkreten, mitnehmbaren Punkten — knappe Stichworte auf Deutsch,
keine ganzen Sätze. Denke an das Baby (Wickeltasche, Wechselkleidung), passend zum Termin.
4 bis 7 Punkte reichen. Erfinde nichts Unnötiges.`;

export async function suggestPrep(
  client: Anthropic,
  model: string,
  title: string,
  category: string,
): Promise<string[]> {
  const params = {
    model,
    max_tokens: 700,
    system: SYSTEM,
    thinking: { type: "disabled" },
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: PREP_SCHEMA },
    },
    messages: [
      { role: "user", content: `Termin: „${title}" (Kategorie: ${category}). Was sollten wir mitnehmen/erledigen?` },
    ],
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
  return normalizePrep(parsed);
}
