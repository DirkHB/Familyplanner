import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, AI_MODEL, aiConfigured } from "./client";
import { zerlegeEinkauf, saeubere, MAX_ARTIKEL } from "@/lib/shopping/zerlegen";

/**
 * Der Einkaufszettel aus einem Textfeld — sauber.
 *
 * Zerlegt wird ohne KI (lib/shopping/zerlegen.ts). Die KI macht nur das, was
 * eine Regel nicht kann: „2x milch" wird „Milch (2×)", „tomaten dose" wird
 * „Tomaten (Dose)", und aus „was fürs frühstück, brötchen" wird „Brötchen"
 * statt zwei Einträgen, von denen einer keiner ist.
 *
 * Fällt sie aus — kein Schlüssel, kein Netz, ein Fehler —, kommt die Liste
 * trotzdem an, nur unpolierter. Ein Einkaufszettel, der von einem fremden
 * Dienst abhängt, ist kein Einkaufszettel.
 */

const SCHEMA = {
  type: "object",
  properties: {
    artikel: {
      type: "array",
      items: { type: "string" },
      description: "Die einzelnen Artikel, einer je Eintrag, in der Reihenfolge der Eingabe.",
    },
  },
  required: ["artikel"],
  additionalProperties: false,
} as const;

const SYSTEM = `Du räumst einen Einkaufszettel auf.

Du bekommst rohen Text, wie ihn jemand schnell eingetippt oder aus einer Notiz
kopiert hat. Gib die einzelnen Artikel zurück — einen je Eintrag.

Regeln:
- Reihenfolge der Eingabe beibehalten.
- Nichts erfinden und nichts weglassen, was ein Artikel ist.
- Füllwörter entfernen: aus "wir brauchen noch brot" wird "Brot".
- Mengen behalten, aber lesbar: "2x milch" wird "Milch (2×)".
- Sorten und Zusätze in Klammern: "tomaten dose" wird "Tomaten (Dose)".
- Groß-/Kleinschreibung wie im Deutschen üblich: Substantive groß.
- Was kein Artikel ist (Grußformeln, "Einkauf", "Liste:"), fällt weg.
- Nie mehr als ${MAX_ARTIKEL} Einträge.

Antworte ausschließlich im vorgegebenen JSON-Format.`;

/**
 * Was aus einer Eingabe wird.
 *
 * `geputzt` sagt, ob die KI beteiligt war. Die Oberfläche zeigt das nicht an —
 * es steht hier für den Fall, dass wir dem Ergebnis einmal nachgehen müssen.
 */
export type Zerlegt = { artikel: string[]; geputzt: boolean };

export async function zerlegeMitKi(text: string): Promise<Zerlegt> {
  const roh = zerlegeEinkauf(text).slice(0, MAX_ARTIKEL);
  if (roh.length === 0) return { artikel: [], geputzt: false };
  if (!aiConfigured()) return { artikel: roh, geputzt: false };

  try {
    const client = getAnthropic();
    const params = {
      model: AI_MODEL,
      max_tokens: 1000,
      system: SYSTEM,
      thinking: { type: "disabled" },
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCHEMA },
      },
      messages: [{ role: "user", content: text }],
      // output_config/effort sind neuere Felder — SDK-Typen hinken teils hinterher.
    } as unknown as Anthropic.MessageCreateParamsNonStreaming;

    const res = await client.messages.create(params);
    const block = res.content.find((b) => b.type === "text");
    const parsed = JSON.parse(block && block.type === "text" ? block.text : "{}") as {
      artikel?: unknown;
    };
    const sauber = saeubere(parsed.artikel);
    // Kommt nichts Brauchbares zurück, gilt das Selbstgerechnete. Eine leere
    // Antwort als „keine Artikel" zu lesen hieße, die Eingabe zu verlieren.
    return sauber.length > 0 ? { artikel: sauber, geputzt: true } : { artikel: roh, geputzt: false };
  } catch {
    return { artikel: roh, geputzt: false };
  }
}
