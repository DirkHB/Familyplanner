import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { aktuellerHaushalt } from "@/lib/haushalt/aktuell";
import { haushaltProfil, beideNamen, nameFuerSlot, type HaushaltProfil } from "@/lib/haushalt/profil";
import { HAUPTLISTE_FILTER } from "@/lib/haushalt/singletons";
import { getAnthropic, aiConfigured, AI_MODEL } from "./client";
import { getRangeData } from "@/lib/calendar/range-data";
import {
  startOfDayBerlin,
  dayKey,
  formatTime,
  formatWeekday,
  tageEinesVorkommens,
} from "@/lib/calendar/format";
import { buildStrahl, STANDARD_FENSTER } from "@/lib/calendar/zeitstrahl";
import { listStores } from "@/lib/shopping/repository";
import { titleKey } from "@/lib/care/gaps";
import {
  ABWESENHEIT_ART,
  EINORDNUNG_ART,
  istBesuch,
  istWeg,
  kommtInFrage,
} from "@/lib/klaerung/abwesenheit";

/**
 * Das Assistenten-Briefing: liest Termine, Aufgaben und Einkauf ZUSAMMEN und
 * sagt, was daraus folgt — nicht, was ohnehin in der Liste steht.
 *
 * „Morgen Abend ist Reginas Dinner, das Geschenk wolltet ihr beim Käfer
 * kaufen — um 11 ist Luft, dann könnt ihr euch dort gleich Lunch mitnehmen."
 * DAS ist der Anspruch. Eine Aufzählung der Termine ist der Fehlschlag.
 *
 * Gerechnet wird höchstens einmal je Datenstand: Der Kontext wird gehasht
 * und das Ergebnis in der Briefing-Tabelle abgelegt. Ändert sich nichts,
 * antwortet der Cache — die Woche wartet nie auf die KI (der Client holt
 * das Briefing nach dem Rendern ab).
 */

const KIND = "ki-woche";

export async function sammleKontext(now: Date = new Date()): Promise<string> {
  const from = startOfDayBerlin(now);
  const to = new Date(from.getTime() + 4 * 86_400_000);
  const heuteKey = dayKey(now);
  const profil = await haushaltProfil();
  const kind = profil.kind;

  const [{ occurrences, careByOcc }, todos, einkauf, laeden, listen] = await Promise.all([
    getRangeData(from, to),
    prisma.todo.findMany({
      where: {
        status: "offen",
        OR: [{ dueDate: { lt: to } }, { dueDate: null, important: true }],
      },
      orderBy: { dueDate: { sort: "asc", nulls: "last" } },
      take: 15,
      select: { title: true, dueDate: true, listId: true, assignee: true },
    }),
    prisma.shoppingItem.findMany({
      where: { checkedAt: null, ...HAUPTLISTE_FILTER },
      take: 20,
      select: { text: true, storeId: true },
    }),
    listStores(),
    prisma.todoList.findMany({ select: { id: true, name: true } }),
  ]);

  const ladenName = new Map(laeden.map((l) => [l.id, l.name]));
  const listenName = new Map(listen.map((l) => [l.id, l.name]));

  const zeilen: string[] = [];

  // Ganztägiges und Termine gehören in getrennte Abschnitte. Zusammen gelesen
  // wird „Mama in München" zu einem Programmpunkt um 0 Uhr — dabei ist es die
  // Lage des Tages, aus der überhaupt erst etwas folgt.
  const mitUhrzeit = occurrences.filter((o) => !o.allDay);
  const kulisse = occurrences.filter((o) => o.allDay);

  zeilen.push("TERMINE MIT UHRZEIT (nächste 4 Tage):");
  for (const o of mitUhrzeit) {
    const tag = dayKey(o.start) === heuteKey ? "heute" : formatWeekday(o.start);
    const zeit = `${formatTime(o.start)}–${formatTime(o.end)}`;
    const care = careByOcc.get(`${o.uid}:${dayKey(o.start)}`);
    const careTxt =
      care?.status === "offen"
        ? ` [Betreuung für ${kind} noch OFFEN]`
        : care?.status === "extern"
          ? ` [${care.externName ?? "Babysitter"} ist bei ${kind}]`
          : care?.person
            ? ` [${nameFuerSlot(profil, care.person)} ist bei ${kind}]`
            : "";
    const vorbei = o.end <= now ? " (vorbei)" : "";
    zeilen.push(`- ${tag} ${zeit}: ${o.summary}${careTxt}${vorbei}`);
  }
  if (mitUhrzeit.length === 0) zeilen.push("- keine");

  /*
   * Was die mehrtägigen Einträge bedeuten, steht längst da.
   *
   * Eingeordnet wird im Hintergrund (lib/klaerung/einordnung-lauf.ts) — hier
   * wird nur nachgeschlagen. Ohne das liest sich „Mallorca" wie ein Ort und
   * „Mama in München" wie eine Reise, und beides führt zu Vorschlägen, die
   * daneben liegen: ein Einkauf um die Ecke, während ihr am Strand seid.
   */
  const mehrtaegigeKeys = [
    ...new Set(
      kulisse
        .filter((o) => kommtInFrage(o.allDay, tageEinesVorkommens(o).length))
        .map((o) => titleKey(o.summary)),
    ),
  ];
  const regeln = mehrtaegigeKeys.length
    ? await prisma.titelRegel.findMany({
        where: { art: { in: [ABWESENHEIT_ART, EINORDNUNG_ART] }, titleKey: { in: mehrtaegigeKeys } },
        select: { art: true, titleKey: true, entscheidung: true },
      })
    : [];
  const menschSagt = new Map(
    regeln.filter((r) => r.art === ABWESENHEIT_ART).map((r) => [r.titleKey, r.entscheidung]),
  );
  const maschineSagt = new Map(
    regeln.filter((r) => r.art === EINORDNUNG_ART).map((r) => [r.titleKey, r.entscheidung]),
  );

  const wegZeilen: string[] = [];

  zeilen.push("WIE DIE TAGE LIEGEN (ganztägige Einträge — Kulisse, keine Termine):");
  const letzterKey = dayKey(new Date(to.getTime() - 1));
  const label = (k: string) => (k === heuteKey ? "heute" : formatWeekday(new Date(`${k}T12:00:00Z`)));
  let gezeigt = 0;
  for (const o of kulisse) {
    // Nur die Tage, die überhaupt im Blick sind. Ein Urlaub, der letzte Woche
    // begann, soll nicht mit „Mi" anfangen — und einer, der zwei Wochen geht,
    // nicht mit einem Wochentag enden, der zweimal vorkommt.
    const tage = tageEinesVorkommens(o);
    const sichtbar = tage.filter((k) => k >= heuteKey && k <= letzterKey);
    if (sichtbar.length === 0) continue;
    const weiter = tage[tage.length - 1] > letzterKey ? " und darüber hinaus" : "";
    const spanne =
      sichtbar.length === 1
        ? label(sichtbar[0])
        : `${label(sichtbar[0])} bis ${label(sichtbar[sichtbar.length - 1])}`;
    const key = titleKey(o.summary);
    const weg = istWeg(menschSagt.get(key), maschineSagt.get(key));
    const besuch = istBesuch(menschSagt.get(key), maschineSagt.get(key));
    const marke = weg ? " [ihr seid weg]" : besuch ? " [Besuch ist da]" : "";
    if (weg) wegZeilen.push(`${spanne}${weiter} (${o.summary})`);
    zeilen.push(`- ${spanne}${weiter}: ${o.summary}${marke}`);
    gezeigt++;
  }
  if (gezeigt === 0) zeilen.push("- nichts");

  /*
   * Die eine Zeile, auf die es ankommt.
   *
   * Sie steht extra da und nicht nur als Marke oben: Ob ihr zu Hause seid,
   * entscheidet über jeden einzelnen Vorschlag darunter — und was nur als
   * Nebensatz in einer Aufzählung steht, geht unter.
   */
  if (wegZeilen.length) {
    zeilen.push(`IHR SEID NICHT ZU HAUSE: ${wegZeilen.join("; ")}`);
  }

  const heutige = occurrences.filter((o) => dayKey(o.start) === heuteKey && !o.allDay);
  const strahl = buildStrahl(
    heutige.map((o) => ({ key: o.uid, start: o.start, end: o.end })),
    heuteKey,
    STANDARD_FENSTER,
  );
  const frei = strahl.filter((s) => s.art === "frei").map((s) => (s.art === "frei" ? s.label : ""));
  zeilen.push(`FREIE BLÖCKE heute: ${frei.length ? frei.join(", ") : "keine nennenswerten"}`);

  zeilen.push("OFFENE AUFGABEN (fällig bald oder wichtig):");
  const dueFmt = new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: "Europe/Berlin" });
  for (const t of todos) {
    const liste = t.listId ? listenName.get(t.listId) : null;
    const faellig = t.dueDate
      ? t.dueDate < from
        ? "überfällig"
        : `fällig ${dayKey(t.dueDate) === heuteKey ? "heute" : dueFmt.format(t.dueDate)}`
      : "ohne Datum, wichtig";
    zeilen.push(`- ${t.title} (${faellig}${liste ? `, Liste ${liste}` : ""})`);
  }
  if (todos.length === 0) zeilen.push("- keine");

  zeilen.push("EINKAUFSLISTE (offen, nach Laden):");
  for (const e of einkauf) {
    zeilen.push(`- ${e.text} (${e.storeId ? (ladenName.get(e.storeId) ?? "Sonstiges") : "Sonstiges"})`);
  }
  if (einkauf.length === 0) zeilen.push("- leer");

  return zeilen.join("\n");
}

const anweisung = (leute: string, kind: string) => `Du bist der stille Familienassistent von ${leute} (Kind: ${kind}).
Schreibe EIN kurzes Briefing für den Kopf ihrer Wochenansicht. Beide lesen denselben Text.

Regeln:
- Deutsch, per du, warm und konkret. 2 bis 4 kurze Sätze, insgesamt unter 350 Zeichen.
- Zähle NIEMALS einfach Termine auf — die stehen direkt darunter. Sag, was aus den Daten FOLGT.
- Verbinde, was zusammengehört: eine Aufgabe, die zu einem Termin gehört; ein Einkauf, dessen Laden
  in eine freie Lücke passt; ein Abendtermin morgen, für den heute etwas zu besorgen ist.
- Schlage konkrete Uhrzeiten nur vor, wenn ein freier Block sie wirklich hergibt.
- Wenn der Tag voll ist, sag es ehrlich und empfiehl eine Pause in einer echten Lücke.
  Wenn er leicht ist, sag das in einem Satz — ohne künstliche Ratschläge.
- Offene Betreuung für ${kind} ist immer erwähnenswert.

Zu „WIE DIE TAGE LIEGEN":
- Das sind keine Termine. Ein Geburtstag, eine Hochzeit, ein Besuch — sie stehen im Kalender,
  damit man weiß, wie der Tag liegt. Sag deshalb nie, dass etwas davon „ansteht" oder wann es ist.
  Sag, was dadurch möglich oder nötig wird.
- Nötig: Woran vorher zu denken ist — Geschenk, Anruf, Kleidung, Anfahrt. Aber nur,
  wenn es in Aufgaben oder Einkauf noch nicht steht.
- Möglich: Ist jemand da („Mama in München"), dann ist das ein Besuch, kein weiterer Babysitter.
  Zeit MIT der Person gehört genauso dazu wie ein Abend zu zweit, weil jemand bei ${kind} bleiben kann.
  Beides nur vorschlagen, wenn der Kalender an dem Tag wirklich Luft lässt.
- Höchstens EIN solcher Gedanke je Briefing, und nur, wenn er trägt. Lieber nichts sagen
  als etwas Beliebiges.

Wenn „IHR SEID NICHT ZU HAUSE" dasteht:
- Dann seid ihr in dieser Zeit weg. Schlage nichts vor, was nur zu Hause geht — kein Einkauf
  um die Ecke, kein Handwerker, keine Wäsche, kein Keller, kein Termin in der Nachbarschaft.
- Was VOR der Abreise erledigt sein muss, ist dagegen das Wichtigste, was du sagen kannst —
  aber nur, wenn es in Aufgaben oder Einkauf wirklich dasteht.
- Ist eine Aufgabe erst nach der Rückkehr fällig, lass sie in Ruhe. Sie mahnt sich später
  von selbst an.
- Sag nicht „ihr seid ja weg" als Feststellung. Es steht im Kalender, ihr wisst es.
- Erfinde nichts. Keine Emojis, keine Anrede, keine Grußformel, keine Aufzählungszeichen.`;

async function frageAssistent(kontext: string, profil: HaushaltProfil): Promise<string | null> {
  const res = await getAnthropic().messages.create({
    model: AI_MODEL,
    max_tokens: 300,
    thinking: { type: "disabled" },
    system: anweisung(beideNamen(profil), profil.kind),
    messages: [{ role: "user", content: `Stand jetzt:\n\n${kontext}\n\nSchreibe das Briefing.` }],
  });
  const text = res.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .trim();
  return text || null;
}

/**
 * Briefing holen — aus dem Cache, solange sich am Datenstand nichts geändert
 * hat, sonst frisch von der KI. `null`, wenn keine KI konfiguriert ist oder
 * der Aufruf scheitert; die Ansicht zeigt dann die nüchterne Kopfzeile.
 */
export async function generiereAssistentBriefing(now: Date = new Date()): Promise<string | null> {
  if (!aiConfigured()) return null;
  try {
    const kontext = await sammleKontext(now);
    const hash = createHash("sha256").update(kontext).digest("hex").slice(0, 16);
    const tag = dayKey(now);
    // Der zusammengesetzte Schlüssel muss den Haushalt nennen — bei eindeutigen
    // Schlüsseln lässt Prisma nichts anderes zu, der Riegel kommt dort nicht ran.
    const haushalt = await aktuellerHaushalt("Assistent-Briefing");

    const cached = await prisma.briefing.findUnique({
      where: { householdId_kind_dayKey: { householdId: haushalt, kind: KIND, dayKey: tag } },
    });
    if (cached) {
      try {
        const p = JSON.parse(cached.summary) as { hash?: string; text?: string };
        if (p.hash === hash && p.text) return p.text;
      } catch {
        /* altes Format — neu rechnen */
      }
    }

    const text = await frageAssistent(kontext, await haushaltProfil());
    if (!text) return null;
    await prisma.briefing.upsert({
      where: { householdId_kind_dayKey: { householdId: haushalt, kind: KIND, dayKey: tag } },
      create: { kind: KIND, dayKey: tag, summary: JSON.stringify({ hash, text }) },
      update: { summary: JSON.stringify({ hash, text }) },
    });
    return text;
  } catch {
    return null;
  }
}
