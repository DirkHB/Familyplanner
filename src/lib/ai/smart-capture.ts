import type Anthropic from "@anthropic-ai/sdk";

/**
 * Smart-Erfassung: ein Eingabefeld für alles. Die KI entscheidet, ob aus dem
 * Text ein Termin, eine Aufgabe oder ein Einkaufsartikel wird — und für wen.
 * Nichts wird automatisch gespeichert: alles läuft über die Vorschau.
 */

export type SmartKind = "termin" | "aufgabe" | "einkauf";

export type SmartItem = {
  kind: SmartKind;
  title: string;
  start: string; // ISO, nur bei Terminen sinnvoll
  end: string;
  allDay: boolean;
  category: string;
  careNeeded: boolean;
  assignee: "" | "dirk" | "constanze";
  dueDate: string; // YYYY-MM-DD, nur bei Aufgaben
  store: string; // Laden, nur bei Einkauf
  notes: string;
};

export type SmartResult = { items: SmartItem[] };

const CATEGORIES = ["arzt", "sport", "besuch", "erledigung", "geburtstag", "sonstiges"];
const STORES = ["lidl", "ali", "edeka", "kaefer", "sonstiges"];

export const SMART_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: { type: "string", enum: ["termin", "aufgabe", "einkauf"] },
          title: { type: "string" },
          start: { type: "string" },
          end: { type: "string" },
          allDay: { type: "boolean" },
          category: { type: "string", enum: CATEGORIES },
          careNeeded: { type: "boolean" },
          assignee: { type: "string", enum: ["", "dirk", "constanze"] },
          dueDate: { type: "string" },
          store: { type: "string", enum: STORES },
          notes: { type: "string" },
        },
        required: ["kind", "title", "start", "end", "allDay", "category", "careNeeded", "assignee", "dueDate", "store", "notes"],
      },
    },
  },
  required: ["items"],
} as const;

/** Defensiv: nie werfen, immer brauchbare Items liefern. */
export function normalizeSmart(raw: unknown): SmartResult {
  const obj = (raw ?? {}) as { items?: unknown };
  const list = Array.isArray(obj.items) ? obj.items : [];
  const items: SmartItem[] = [];
  for (const it of list) {
    const s = (it ?? {}) as Partial<SmartItem>;
    if (!s.title) continue;
    const kind: SmartKind =
      s.kind === "aufgabe" || s.kind === "einkauf" || s.kind === "termin" ? s.kind : "aufgabe";
    items.push({
      kind,
      title: String(s.title).slice(0, 200),
      start: String(s.start ?? ""),
      end: String(s.end ?? s.start ?? ""),
      allDay: !!s.allDay,
      category: CATEGORIES.includes(String(s.category)) ? String(s.category) : "sonstiges",
      careNeeded: !!s.careNeeded,
      assignee: s.assignee === "dirk" || s.assignee === "constanze" ? s.assignee : "",
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(s.dueDate)) ? String(s.dueDate) : "",
      store: STORES.includes(String(s.store)) ? String(s.store) : "sonstiges",
      notes: typeof s.notes === "string" ? s.notes.slice(0, 300) : "",
    });
    if (items.length >= 8) break;
  }
  return { items };
}

function systemPrompt(todayISO: string, weekday: string): string {
  return `Du hilfst Constanze und Dirk (Paar mit Neugeborenem in Deutschland), Dinge schnell zu erfassen.
Heute ist ${weekday}, ${todayISO} (Europe/Berlin).

Ordne jede Sache genau einer Art zu:
- "termin": hat einen Zeitpunkt/Tag und findet statt (Arzt, Besuch, Sport, Treffen).
- "einkauf": ein Produkt, das gekauft werden soll (Windeln, Milch, Kaffee).
- "aufgabe": etwas zu Erledigendes ohne festen Termin (anrufen, buchen, kündigen).

Regeln:
- Mehrere Dinge in einem Satz → mehrere Items.
- Zeiten immer als ISO-8601 mit Zeitzone (+02:00 im Sommer, +01:00 im Winter).
- Bei Aufgaben "dueDate" (YYYY-MM-DD) setzen, wenn ein Termin genannt ist, sonst leer.
- "assignee" nur setzen, wenn eine Person klar genannt ist ("Constanze soll…" → constanze).
- careNeeded nur bei Terminen, zu denen offensichtlich jemand ohne Baby hin muss.
- Bei Einkauf den Laden raten, wenn er genannt wird; sonst "sonstiges".
- Titel kurz und konkret halten. Nichts erfinden, was nicht dasteht.`;
}

export async function smartCapture(
  client: Anthropic,
  model: string,
  text: string,
  now: Date = new Date(),
): Promise<SmartResult> {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(now);
  const weekday = new Intl.DateTimeFormat("de-DE", { weekday: "long", timeZone: "Europe/Berlin" }).format(now);

  const params = {
    model,
    max_tokens: 2000,
    system: systemPrompt(today, weekday),
    thinking: { type: "disabled" },
    output_config: { effort: "low", format: { type: "json_schema", schema: SMART_SCHEMA } },
    messages: [{ role: "user", content: text }],
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
  return normalizeSmart(parsed);
}
