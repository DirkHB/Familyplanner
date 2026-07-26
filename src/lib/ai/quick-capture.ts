import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, AI_MODEL } from "./client";
import { CAPTURE_SCHEMA, normalizeCapture, type CaptureResult } from "./schemas";

/** KI-Schnellerfassung: Freitext → strukturierte Terminvorschläge (nur Vorschau). */

function systemPrompt(now: Date): string {
  const md = readFileSync(join(process.cwd(), "prompts", "schnellerfassung.v1.md"), "utf8");
  const body = md.split("## System-Prompt")[1] ?? md;
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(now);
  const weekday = new Intl.DateTimeFormat("de-DE", { weekday: "long", timeZone: "Europe/Berlin" }).format(now);
  return body.replace(/\{\{today\}\}/g, today).replace(/\{\{weekday\}\}/g, weekday).trim();
}

export async function quickCapture(text: string, now: Date = new Date()): Promise<CaptureResult> {
  const client = getAnthropic();
  const params = {
    model: AI_MODEL,
    max_tokens: 2000,
    system: systemPrompt(now),
    thinking: { type: "disabled" },
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: CAPTURE_SCHEMA },
    },
    messages: [{ role: "user", content: text }],
    // output_config/effort sind neuere Felder — SDK-Typen hinken teils hinterher.
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
  return normalizeCapture(parsed);
}
