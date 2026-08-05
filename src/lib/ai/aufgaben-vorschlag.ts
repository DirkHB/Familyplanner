import "server-only";
import { getAnthropic, aiConfigured, AI_MODEL } from "./client";
import { nuechternerVorschlag, kontextText, type VorschlagKontext } from "./vorschlag-text";

/**
 * Der Text für den täglichen Aufgaben-Anstoß.
 *
 * Er landet als Mitteilung auf dem Sperrbildschirm — also kurz, konkret und
 * ohne Aufzählung. Nicht „5 Aufgaben offen", sondern welche davon in genau
 * dieses Fenster passt und warum jetzt der Moment ist.
 *
 * Ohne KI (oder wenn der Aufruf scheitert) greift der nüchterne Satz aus
 * `vorschlag-text`. Eine Mitteilung darf nie daran hängen, dass ein fremder
 * Dienst antwortet.
 */

export type { VorschlagKontext };

const ANWEISUNG = `Du bist der stille Familienassistent von Constanze und Dirk (Baby: Nicolas).
Schreibe den Text EINER Mitteilung auf dem Handy zu den offenen Aufgaben.

Regeln:
- Deutsch, per du, warm und konkret. HÖCHSTENS 140 Zeichen, ein bis zwei Sätze.
- Nenne höchstens zwei Aufgaben, und zwar die, die in das genannte Zeitfenster wirklich passen.
- Zähle nie alle Aufgaben auf und nenne keine Gesamtzahl.
- Gibt es ein Fenster, sag, dass jetzt Luft ist, und wofür.
- Gibt es heute keins, sag das ehrlich und nenne eine Lücke von morgen, falls eine dasteht.
- Erfinde nichts: keine Aufgabe, kein Datum, keine Uhrzeit, die nicht dasteht.
- Keine Emojis, keine Anrede, keine Grußformel, keine Aufzählungszeichen.`;

export async function generiereAufgabenVorschlag(k: VorschlagKontext): Promise<string> {
  const rueckfall = nuechternerVorschlag(k);
  if (!aiConfigured() || k.aufgaben.length === 0) return rueckfall;
  try {
    const res = await getAnthropic().messages.create({
      model: AI_MODEL,
      max_tokens: 200,
      thinking: { type: "disabled" },
      system: ANWEISUNG,
      messages: [{ role: "user", content: `Stand jetzt:\n\n${kontextText(k)}\n\nSchreibe die Mitteilung.` }],
    });
    const text = res.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    // Eine Mitteilung wird abgeschnitten, wenn sie zu lang ist — dann lieber
    // den kurzen Satz, der ganz ankommt.
    if (!text || text.length > 180) return rueckfall;
    return text;
  } catch {
    return rueckfall;
  }
}
