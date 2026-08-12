import { createHash } from "node:crypto";

/**
 * Ein abonnierter Kalender ist eine einzige Datei.
 *
 * CalDAV liefert jeden Termin als eigenes Objekt mit eigener Adresse. Ein
 * Abonnement liefert stattdessen alles auf einmal: eine .ics-Datei mit
 * hundert VEVENTs darin. Damit der Rest der App nichts davon merkt, wird sie
 * hier in dieselben Einzelteile zerlegt, die auch von iCloud kommen.
 *
 * Zwei Dinge müssen dabei stimmen, sonst rechnet die Wochenansicht falsch:
 *
 * 1. **Zeitzonen bleiben dran.** Ein VEVENT mit `DTSTART;TZID=Europe/Berlin`
 *    ist ohne den passenden VTIMEZONE-Block nicht auswertbar. Der steht im
 *    Feed genau einmal, ganz oben — jedes Einzelstück bekommt ihn mit.
 * 2. **Eine Serie bleibt ein Stück.** Wird ein einzelnes Vorkommen geändert,
 *    steht es als zweites VEVENT mit derselben UID und einer RECURRENCE-ID im
 *    Feed. Beide gehören in dieselbe Datei, sonst überschreiben sie sich
 *    gegenseitig — dieselbe Falle wie bei iCloud.
 */

/** Ein Einzelteil, wie es auch von CalDAV käme. */
export type FeedStueck = { uid: string; ics: string; etag: string };

/**
 * Zeilenumbrüche nach RFC 5545 auflösen.
 *
 * Lange Werte werden umbrochen und mit einem Leerzeichen oder Tabulator
 * fortgesetzt. Wer das nicht zusammensetzt, liest eine halbe UID.
 */
export function entfalte(text: string): string[] {
  const zeilen: string[] = [];
  for (const roh of text.split(/\r?\n/)) {
    if ((roh.startsWith(" ") || roh.startsWith("\t")) && zeilen.length > 0) {
      zeilen[zeilen.length - 1] += roh.slice(1);
    } else {
      zeilen.push(roh);
    }
  }
  return zeilen;
}

/** Der Wert einer Eigenschaft, ohne Parameter: „DTSTART;TZID=X:123" → „123". */
function wert(zeile: string): string {
  const doppelpunkt = zeile.indexOf(":");
  return doppelpunkt === -1 ? "" : zeile.slice(doppelpunkt + 1).trim();
}

function istEigenschaft(zeile: string, name: string): boolean {
  const kopf = zeile.split(":")[0].split(";")[0];
  return kopf.toUpperCase() === name;
}

/**
 * Den Feed in Einzelteile zerlegen — eines je UID.
 *
 * Was keine UID hat, fällt weg: Ohne sie könnten wir den Termin bei der
 * nächsten Runde nicht wiedererkennen und legten ihn jedes Mal neu an.
 */
export function zerlegeFeed(text: string): FeedStueck[] {
  const zeilen = entfalte(text ?? "");

  const kopf: string[] = ["BEGIN:VCALENDAR"];
  const zeitzonen: string[] = [];
  const termine = new Map<string, string[]>();

  let block: string[] | null = null;
  let art: "VEVENT" | "VTIMEZONE" | null = null;
  let tiefe = 0;

  for (const zeile of zeilen) {
    const z = zeile.trim();
    if (!z) continue;

    if (z === "BEGIN:VEVENT" || z === "BEGIN:VTIMEZONE") {
      if (block) {
        // Verschachtelt (VALARM in VEVENT, DAYLIGHT in VTIMEZONE) — mitnehmen.
        tiefe++;
        block.push(z);
        continue;
      }
      art = z === "BEGIN:VEVENT" ? "VEVENT" : "VTIMEZONE";
      block = [z];
      continue;
    }

    if (block) {
      block.push(z);
      if (z.startsWith("BEGIN:")) tiefe++;
      else if (z.startsWith("END:")) {
        if (tiefe > 0) {
          tiefe--;
        } else {
          if (art === "VTIMEZONE") {
            zeitzonen.push(...block);
          } else {
            const uid = block.find((b) => istEigenschaft(b, "UID"));
            const kennung = uid ? wert(uid) : "";
            // Eine Serie und ihre Ausnahmen teilen sich die UID und gehören
            // damit in dieselbe Datei.
            if (kennung) termine.set(kennung, [...(termine.get(kennung) ?? []), ...block]);
          }
          block = null;
          art = null;
        }
      }
      continue;
    }

    // Alles außerhalb der Blöcke: der Kopf der Datei.
    if (
      istEigenschaft(z, "VERSION") ||
      istEigenschaft(z, "PRODID") ||
      istEigenschaft(z, "CALSCALE") ||
      istEigenschaft(z, "METHOD")
    ) {
      kopf.push(z);
    }
  }

  if (!kopf.some((k) => istEigenschaft(k, "VERSION"))) kopf.splice(1, 0, "VERSION:2.0");

  return [...termine.entries()].map(([uid, teile]) => {
    const ics = [...kopf, ...zeitzonen, ...teile, "END:VCALENDAR"].join("\r\n");
    return { uid, ics, etag: abdruck(ics) };
  });
}

/**
 * Ein Ersatz für das ETag.
 *
 * Ein Abonnement kennt keine ETags — es gibt nur die eine Datei. Der Abdruck
 * des Einzelteils tut dasselbe: Er ändert sich genau dann, wenn sich am
 * Termin etwas geändert hat, und hält den Abgleich damit billig.
 */
export function abdruck(ics: string): string {
  return createHash("sha256").update(ics).digest("hex").slice(0, 32);
}
