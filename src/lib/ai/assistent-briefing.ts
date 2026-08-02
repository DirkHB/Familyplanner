import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getAnthropic, aiConfigured, AI_MODEL } from "./client";
import { getRangeData } from "@/lib/calendar/range-data";
import { startOfDayBerlin, dayKey, formatTime, formatWeekday } from "@/lib/calendar/format";
import { buildStrahl, STANDARD_FENSTER } from "@/lib/calendar/zeitstrahl";
import { listStores } from "@/lib/shopping/repository";

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
      where: { checkedAt: null, list: { kind: "haupt" } },
      take: 20,
      select: { text: true, storeId: true },
    }),
    listStores(),
    prisma.todoList.findMany({ select: { id: true, name: true } }),
  ]);

  const ladenName = new Map(laeden.map((l) => [l.id, l.name]));
  const listenName = new Map(listen.map((l) => [l.id, l.name]));

  const zeilen: string[] = [];

  zeilen.push("TERMINE (nächste 4 Tage):");
  for (const o of occurrences) {
    const tag = dayKey(o.start) === heuteKey ? "heute" : formatWeekday(o.start);
    const zeit = o.allDay ? "ganztägig" : `${formatTime(o.start)}–${formatTime(o.end)}`;
    const care = careByOcc.get(`${o.uid}:${dayKey(o.start)}`);
    const careTxt =
      care?.status === "offen"
        ? " [Betreuung für Nicolas noch OFFEN]"
        : care?.status === "extern"
          ? " [Babysitter ist bei Nicolas]"
          : care?.person
            ? ` [${care.person === "constanze" ? "Constanze" : "Dirk"} ist bei Nicolas]`
            : "";
    const vorbei = o.end <= now ? " (vorbei)" : "";
    zeilen.push(`- ${tag} ${zeit}: ${o.summary}${careTxt}${vorbei}`);
  }
  if (occurrences.length === 0) zeilen.push("- keine");

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

const ANWEISUNG = `Du bist der stille Familienassistent von Constanze und Dirk (Baby: Nicolas).
Schreibe EIN kurzes Briefing für den Kopf ihrer Wochenansicht. Beide lesen denselben Text.

Regeln:
- Deutsch, per du, warm und konkret. 2 bis 4 kurze Sätze, insgesamt unter 350 Zeichen.
- Zähle NIEMALS einfach Termine auf — die stehen direkt darunter. Sag, was aus den Daten FOLGT.
- Verbinde, was zusammengehört: eine Aufgabe, die zu einem Termin gehört; ein Einkauf, dessen Laden
  in eine freie Lücke passt; ein Abendtermin morgen, für den heute etwas zu besorgen ist.
- Schlage konkrete Uhrzeiten nur vor, wenn ein freier Block sie wirklich hergibt.
- Wenn der Tag voll ist, sag es ehrlich und empfiehl eine Pause in einer echten Lücke.
  Wenn er leicht ist, sag das in einem Satz — ohne künstliche Ratschläge.
- Offene Betreuung für Nicolas ist immer erwähnenswert.
- Erfinde nichts. Keine Emojis, keine Anrede, keine Grußformel, keine Aufzählungszeichen.`;

async function frageAssistent(kontext: string): Promise<string | null> {
  const res = await getAnthropic().messages.create({
    model: AI_MODEL,
    max_tokens: 300,
    thinking: { type: "disabled" },
    system: ANWEISUNG,
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

    const cached = await prisma.briefing.findUnique({
      where: { kind_dayKey: { kind: KIND, dayKey: tag } },
    });
    if (cached) {
      try {
        const p = JSON.parse(cached.summary) as { hash?: string; text?: string };
        if (p.hash === hash && p.text) return p.text;
      } catch {
        /* altes Format — neu rechnen */
      }
    }

    const text = await frageAssistent(kontext);
    if (!text) return null;
    await prisma.briefing.upsert({
      where: { kind_dayKey: { kind: KIND, dayKey: tag } },
      create: { kind: KIND, dayKey: tag, summary: JSON.stringify({ hash, text }) },
      update: { summary: JSON.stringify({ hash, text }) },
    });
    return text;
  } catch {
    return null;
  }
}
