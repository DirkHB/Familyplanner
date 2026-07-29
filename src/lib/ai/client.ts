import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic-Client, nur serverseitig. Key niemals im Client.
 * Modell per Env konfigurierbar (Default: claude-sonnet-5) — reicht für die
 * strukturierten Aufgaben hier locker aus. Für mehr Qualität ginge claude-opus-5,
 * für weniger Kosten claude-haiku-4-5.
 */

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY fehlt — KI ist nicht konfiguriert.");
  }
  if (!cached) cached = new Anthropic();
  return cached;
}

export function aiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
