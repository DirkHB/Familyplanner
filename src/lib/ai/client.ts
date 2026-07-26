import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic-Client, nur serverseitig. Key niemals im Client.
 * Modell per Env konfigurierbar (Default: claude-opus-5) — für Kostenkontrolle
 * kann Dirk auf claude-sonnet-5 oder claude-haiku-4-5 stellen.
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

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";
