import "server-only";
import { prisma } from "@/lib/prisma";
import { getRangeData } from "@/lib/calendar/range-data";
import { startOfDayBerlin, dayKey } from "@/lib/calendar/format";
import { freieBloecke, berlinStunde, dauerLabel, STANDARD_FENSTER } from "@/lib/calendar/zeitstrahl";
import { parseAllowlist, personForEmail, displayNameForEmail } from "@/lib/auth/allowlist";
import { mergePrefs } from "@/lib/push/quiet-hours";
import { notifyUserId } from "@/lib/push/notify";
import { generiereAufgabenVorschlag, type VorschlagKontext } from "@/lib/ai/aufgaben-vorschlag";
import { waehleFenster, fensterLabel } from "./fenster";

/**
 * Der tägliche Aufgaben-Anstoß — verschickt in dem Moment, in dem wirklich
 * Zeit da ist.
 *
 * Läuft alle 15 Minuten und schweigt fast immer. Er meldet sich genau
 * einmal am Tag je Person: wenn ein freier Block beginnt (oder gerade läuft
 * und noch genug Rest hat) und tatsächlich etwas offen ist. War der Tag
 * durchgetaktet, kommt in der letzten Stunde des Tagesfensters trotzdem ein
 * ehrlicher Hinweis mit Blick auf morgen — versprochen ist versprochen.
 *
 * Dass schon gesendet wurde, merkt sich die Briefing-Tabelle je Person und
 * Tag. Keine neue Spalte, kein zweiter Ort für denselben Sachverhalt.
 */

export type FensterSummary = { geprueft: number; pushed: number };

const KIND = (person: string) => `aufgaben-fenster-${person}`;

const dueFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  timeZone: "Europe/Berlin",
});

export async function runAufgabenFenster(now: Date = new Date()): Promise<FensterSummary> {
  const summary: FensterSummary = { geprueft: 0, pushed: 0 };
  const heute = dayKey(now);
  const heuteStart = startOfDayBerlin(now);
  const uebermorgen = new Date(heuteStart.getTime() + 2 * 86_400_000);

  const emails = parseAllowlist(process.env.ALLOWED_EMAILS);
  if (emails.length === 0) return summary;

  // Termine für heute und morgen einmal für alle holen — der Kalender ist
  // gemeinsam, die freien Blöcke sind es damit auch.
  const { occurrences } = await getRangeData(heuteStart, uebermorgen);
  const morgenKey = dayKey(new Date(heuteStart.getTime() + 86_400_000 + 43_200_000));

  for (const email of emails) {
    const person = personForEmail(email);
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name: displayNameForEmail(email) },
      update: {},
    });
    summary.geprueft++;

    const prefs = mergePrefs(user.notificationPrefs);
    if (!prefs.taskWindow) continue;

    // Schon gesendet heute? Dann ist für heute Schluss.
    const schon = await prisma.briefing.findUnique({
      where: { kind_dayKey: { kind: KIND(person), dayKey: heute } },
    });
    if (schon) continue;

    const offene = await prisma.todo.findMany({
      where: {
        status: "offen",
        OR: [{ assignee: person }, { assignee: null }],
      },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { id: "asc" }],
      take: 12,
      select: { title: true, dueDate: true, list: { select: { name: true } } },
    });
    if (offene.length === 0) continue;

    const fenster = { vonStunde: user.tagVonStunde ?? STANDARD_FENSTER.vonStunde, bisStunde: user.tagBisStunde ?? STANDARD_FENSTER.bisStunde };
    const tagesEnde = berlinStunde(heute, fenster.bisStunde);

    const alsEvents = (tag: string) =>
      occurrences
        .filter((o) => !o.allDay && dayKey(o.start) === tag)
        .map((o) => ({ key: o.uid, start: o.start, end: o.end }));

    // Nur was noch kommt: Ein Block, der heute Vormittag frei war, ist am
    // Nachmittag keine Gelegenheit mehr.
    const heutigeBloecke = freieBloecke(alsEvents(heute), heute, fenster).filter((b) => b.bis > now);
    const wahl = waehleFenster(heutigeBloecke, now, tagesEnde);
    if (wahl.art === "warten") continue;

    const morgenFrei = freieBloecke(alsEvents(morgenKey), morgenKey, fenster).map(
      (b) => `ab ${fensterLabel(b).split("–")[0]} (${dauerLabel(b.minuten)})`,
    );

    const kontext: VorschlagKontext = {
      fenster: wahl.art === "fenster" ? fensterLabel(wahl.block) : null,
      fensterMinuten: wahl.art === "fenster" ? Math.round(wahl.block.minuten) : null,
      aufgaben: offene.map((t) => ({
        titel: t.title,
        faellig: t.dueDate
          ? t.dueDate < heuteStart
            ? "überfällig"
            : dayKey(t.dueDate) === heute
              ? "heute fällig"
              : `fällig ${dueFmt.format(t.dueDate)}`
          : null,
        liste: t.list?.name ?? null,
      })),
      morgenFrei: morgenFrei.slice(0, 2),
    };

    const text = await generiereAufgabenVorschlag(kontext);
    const n = await notifyUserId(user.id, {
      title: wahl.art === "fenster" ? `Jetzt ist Luft · ${kontext.fenster}` : "Kurz zu deinen Aufgaben",
      body: text,
      url: "/aufgaben",
      tag: `aufgaben-fenster-${heute}`,
    }).catch(() => 0);

    // Nur als erledigt vermerken, was auch rausging — sonst schluckt eine
    // Ruhezeit den Anstoß des ganzen Tages.
    if (n > 0) {
      summary.pushed++;
      await prisma.briefing
        .create({
          data: {
            kind: KIND(person),
            dayKey: heute,
            summary: text,
            payload: { fenster: kontext.fenster, art: wahl.art },
          },
        })
        .catch(() => null);
    }
  }

  return summary;
}
