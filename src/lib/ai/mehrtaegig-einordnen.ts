import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, AI_MODEL, aiConfigured } from "./client";
import { EINORDNUNGEN, type Einordnung } from "@/lib/klaerung/abwesenheit";

/**
 * Was ein mehrtägiger Ganztagseintrag eigentlich bedeutet.
 *
 * Im Kalender sehen sie alle gleich aus: ein Balken über mehrere Tage.
 * Gemeint ist damit sehr Verschiedenes, und erst die Bedeutung macht daraus
 * etwas Nützliches:
 *
 *   „Mallorca"        — ihr seid weg. Was nur zu Hause geht, geht jetzt nicht.
 *   „Mama in München" — jemand ist DA. Eine Gelegenheit, kein Programmpunkt.
 *   „Sprung 2"        — ein Zustand. Hintergrund, sonst nichts.
 *
 * Ein Mensch sieht das auf einen Blick, eine Regel nie: Zwischen „Mallorca"
 * und „Mama in München" liegt kein Merkmal, das sich abfragen ließe — beides
 * ist ein Ort über mehrere Tage. Deshalb hier ein Modell.
 *
 * Und deshalb auch die vierte Antwort. Wer unsicher ist, soll unsicher sagen
 * dürfen: Aus „unklar" wird eine Frage im Klärungs-Stapel, aus allem anderen
 * nichts — eine Frage, deren Antwort schon feststeht, ist bloß Lärm.
 */

export type { Einordnung };

/** Ein Eintrag, wie ihn das Modell zu sehen bekommt. */
export type Mehrtaegig = {
  titel: string;
  /** Über wie viele Tage er läuft. */
  tage: number;
  ort?: string | null;
};

const SCHEMA = {
  type: "object",
  properties: {
    eintraege: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titel: { type: "string", description: "Der Titel, wortgleich wie in der Eingabe." },
          einordnung: { type: "string", enum: [...EINORDNUNGEN] },
        },
        required: ["titel", "einordnung"],
        additionalProperties: false,
      },
    },
  },
  required: ["eintraege"],
  additionalProperties: false,
} as const;

const SYSTEM = `Du ordnest ganztägige Kalendereinträge einer Familie ein, die über mehrere Tage laufen.

Für jeden Eintrag genau eine von vier Antworten:

- "wegfahrt": Die Familie ist in dieser Zeit nicht zu Hause. Urlaub, Reise,
  ein Wochenende woanders, eine Hochzeit mit Übernachtung.
- "besuch": Jemand anderes ist da oder in der Nähe. Nennt der Titel eine
  Person und einen Ort ("Mama in München", "Thomas & Johanna da"), geht es um
  DIESE Person — nicht um eine Reise der Familie.
- "zustand": Etwas gilt einfach in dieser Zeit. Ein Entwicklungssprung des
  Babys, Kita geschlossen, eine Krankheit, eine Frist, ein Zeitraum ohne
  eigenen Ort.
- "unklar": Aus dem Titel geht es wirklich nicht hervor.

Regeln:
- Ein Ortsname allein heißt noch nicht, dass die Familie dort ist. Steht eine
  Person davor, ist die Person dort — das ist "besuch".
- Nur ein Ortsname ("Mallorca", "Bayrischzell", "Sylt") ohne weitere Angabe:
  "wegfahrt".
- Im Zweifel "unklar". Eine falsche Sicherheit ist schlimmer als eine Frage.
  Rate nicht.
- Gib jeden Eintrag genau einmal zurück, den Titel wortgleich wie er
  hereinkam.

Antworte ausschließlich im vorgegebenen JSON-Format.`;

function alsText(e: Mehrtaegig): string {
  const dauer = e.tage === 1 ? "1 Tag" : `${e.tage} Tage`;
  const ort = e.ort?.trim() ? `, Ortsangabe: ${e.ort.trim()}` : "";
  return `- ${e.titel} (${dauer}${ort})`;
}

function istEinordnung(x: unknown): x is Einordnung {
  return typeof x === "string" && (EINORDNUNGEN as readonly string[]).includes(x);
}

/**
 * Einträge einordnen. Der Schlüssel im Ergebnis ist der Titel, wie er
 * hereinkam.
 *
 * Ohne KI — oder wenn der Aufruf scheitert — kommt eine leere Karte zurück,
 * nicht etwa „alles unklar". Das ist der Unterschied zwischen „ich weiß es
 * nicht" und „ich frage jetzt zu allem": Ein Haushalt ohne Modell soll nicht
 * für jeden Balken im Kalender eine Frage bekommen.
 */
export async function ordneMehrtaegigeEin(
  eintraege: Mehrtaegig[],
): Promise<Map<string, Einordnung>> {
  const ergebnis = new Map<string, Einordnung>();
  if (!aiConfigured() || eintraege.length === 0) return ergebnis;

  try {
    const params = {
      model: AI_MODEL,
      max_tokens: 1000,
      system: SYSTEM,
      thinking: { type: "disabled" },
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: `Diese Einträge stehen im Kalender:\n\n${eintraege.map(alsText).join("\n")}`,
        },
      ],
      // output_config/effort sind neuere Felder — SDK-Typen hinken teils hinterher.
    } as unknown as Anthropic.MessageCreateParamsNonStreaming;

    const res = await getAnthropic().messages.create(params);
    const block = res.content.find((b) => b.type === "text");
    const parsed = JSON.parse(block && block.type === "text" ? block.text : "{}") as {
      eintraege?: { titel?: unknown; einordnung?: unknown }[];
    };

    const bekannt = new Set(eintraege.map((e) => e.titel));
    for (const z of parsed.eintraege ?? []) {
      // Nur, was auch gefragt war: Ein erfundener Titel bekäme sonst eine
      // Regel, die nie wieder jemand anfasst.
      if (typeof z.titel !== "string" || !bekannt.has(z.titel)) continue;
      if (!istEinordnung(z.einordnung)) continue;
      ergebnis.set(z.titel, z.einordnung);
    }
    return ergebnis;
  } catch {
    return ergebnis;
  }
}
