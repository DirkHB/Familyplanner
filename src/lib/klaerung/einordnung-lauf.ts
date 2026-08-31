import "server-only";
import { prisma } from "@/lib/prisma";
import { aktuellerHaushalt } from "@/lib/haushalt/aktuell";
import { getRangeData } from "@/lib/calendar/range-data";
import { startOfDayBerlin, tageEinesVorkommens } from "@/lib/calendar/format";
import { titleKey } from "@/lib/care/gaps";
import { ordneMehrtaegigeEin } from "@/lib/ai/mehrtaegig-einordnen";
import { EINORDNUNG_ART, kommtInFrage } from "./abwesenheit";

/**
 * Mehrtägige Einträge einordnen — im Hintergrund, nie beim Öffnen der App.
 *
 * Die Wochenansicht darf niemals auf ein Modell warten. Deshalb läuft die
 * Einordnung dort, wo ohnehin gearbeitet wird: nach einem Abgleich, der
 * wirklich etwas verändert hat, und einmal morgens vor dem Briefing. Beim
 * Öffnen der App wird nur noch nachgeschlagen, was längst dasteht.
 *
 * Gefragt wird ausschließlich zu Titeln, die noch keine Einordnung haben.
 * „Mallorca" wird einmal eingeordnet und nie wieder — auch nicht nächstes
 * Jahr.
 */

/** Wie weit vorausgeschaut wird. Weiter lohnt nicht: Was in fünf Wochen
 *  steht, ändert sich noch, und die Einordnung kostet dann eben dann. */
const VORSCHAU_TAGE = 21;

export async function ordneNeueMehrtaegigeEin(now: Date = new Date()): Promise<number> {
  const von = startOfDayBerlin(now);
  const bis = new Date(von.getTime() + VORSCHAU_TAGE * 86_400_000);

  const { occurrences } = await getRangeData(von, bis);

  /*
   * Ein Titel, nicht ein Vorkommen. „Kita geschlossen" steht viermal im Jahr
   * im Kalender und ist viermal dasselbe; die Regel gilt dem Titel, damit die
   * Antwort nicht jedes Mal neu erarbeitet werden muss.
   */
  const kandidaten = new Map<string, { titel: string; tage: number; ort: string | null }>();
  for (const o of occurrences) {
    const tage = tageEinesVorkommens(o).length;
    if (!kommtInFrage(o.allDay, tage)) continue;
    const key = titleKey(o.summary);
    if (!key || kandidaten.has(key)) continue;
    kandidaten.set(key, { titel: o.summary, tage, ort: o.location });
  }
  if (kandidaten.size === 0) return 0;

  const schon = await prisma.titelRegel.findMany({
    where: { art: EINORDNUNG_ART, titleKey: { in: [...kandidaten.keys()] } },
    select: { titleKey: true },
  });
  for (const r of schon) kandidaten.delete(r.titleKey);
  if (kandidaten.size === 0) return 0;

  const antwort = await ordneMehrtaegigeEin([...kandidaten.values()]);
  if (antwort.size === 0) return 0;

  const haushalt = await aktuellerHaushalt("Einordnung mehrtägiger Termine");
  let gezaehlt = 0;
  for (const [key, k] of kandidaten) {
    const einordnung = antwort.get(k.titel);
    if (!einordnung) continue;
    /*
     * Ohne `createdBy`: Das war die Maschine. Wer später einmal wissen will,
     * warum eine Frage nie kam, sieht hier, dass niemand sie beantwortet hat.
     */
    await prisma.titelRegel
      .upsert({
        where: { householdId_art_titleKey: { householdId: haushalt, art: EINORDNUNG_ART, titleKey: key } },
        create: { art: EINORDNUNG_ART, titleKey: key, entscheidung: einordnung, createdBy: null },
        update: { entscheidung: einordnung },
      })
      .catch(() => null);
    gezaehlt++;
  }
  return gezaehlt;
}
