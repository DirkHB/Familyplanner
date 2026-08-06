import "server-only";
import { getRangeData } from "@/lib/calendar/range-data";
import { startOfDayBerlin, wannLabel } from "@/lib/calendar/format";

/**
 * Wann ist der Termin, um den eine Anfrage sich dreht?
 *
 * Die Frage allein sagt es nicht: „Kannst du bei ‚André Termin Constanze
 * 16:00' aufs Baby aufpassen?" nennt zwar eine Uhrzeit — aber nur, weil sie
 * zufällig im Titel steht, und den Tag nennt sie gar nicht. Auf ein „Ja"
 * wartet man nicht, wenn man raten muss, worauf man Ja sagt.
 *
 * Eine Stelle für alle drei Ansichten (Klärungs-Stapel, Woche, Anfragen),
 * damit nirgends ein anderer Tag herauskommt.
 */

const HORIZONT_TAGE = 14;

export async function terminLabelsFuerAnfragen(
  anfragen: { id: string; eventUid: string | null }[],
  now: Date = new Date(),
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  const uids = new Set(anfragen.map((r) => r.eventUid).filter((u): u is string => !!u));
  if (uids.size === 0) return labels;

  const bis = new Date(startOfDayBerlin(now).getTime() + HORIZONT_TAGE * 86_400_000);
  const { occurrences } = await getRangeData(now, bis);

  // Das nächste Vorkommen je Termin — nach ihm wird gefragt.
  const naechstes = new Map<string, { start: Date; allDay: boolean }>();
  for (const o of occurrences) {
    if (!uids.has(o.uid)) continue;
    const bisher = naechstes.get(o.uid);
    if (!bisher || o.start < bisher.start) naechstes.set(o.uid, { start: o.start, allDay: o.allDay });
  }

  for (const r of anfragen) {
    const t = r.eventUid ? naechstes.get(r.eventUid) : null;
    // Kein Treffer heißt: Zeile weglassen. Raten wäre schlimmer als schweigen.
    if (t) labels.set(r.id, wannLabel(t.start, t.allDay, now));
  }
  return labels;
}
