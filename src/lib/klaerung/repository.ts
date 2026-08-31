import "server-only";
import { prisma } from "@/lib/prisma";
import { getRangeData } from "@/lib/calendar/range-data";
import {
  startOfDayBerlin,
  dayKey,
  wannLabel,
  formatWeekday,
  tageEinesVorkommens,
} from "@/lib/calendar/format";
import { isCareGap } from "@/lib/care/gaps";
import { getDismissedTitleKeys } from "@/lib/care/rules";
import { getOpenRequestsForUser } from "@/lib/requests/repository";
import { terminLabelsFuerAnfragen } from "@/lib/requests/termin";
import { notnameAusEmail } from "@/lib/auth/allowlist";
import { berlinWeekday } from "@/lib/overview/horizon";
import type { Occurrence } from "@/lib/calendar/types";
import { buildStack, type KlaerungCard } from "./build";
import {
  VORLAUF_TAGE,
  istGeburtstag,
  istImFragefenster,
  personAusTitel,
} from "./geburtstag";
import { titleKey as titelSchluessel } from "@/lib/care/gaps";
import {
  ABWESENHEIT_ART,
  EINORDNUNG_ART,
  brauchtFrage,
  kommtInFrage,
} from "./abwesenheit";

/**
 * Daten für den Klärungs-Stapel beim Öffnen der App.
 *
 * Zeitfenster bewusst eng: Betreuungsfragen für heute und morgen, Aufgaben
 * für heute (Überfälliges eingeschlossen). Was weiter weg liegt, gehört in
 * den Überblick, nicht in eine Unterbrechung.
 */

const dueFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/Berlin",
});

export async function getKlaerungStack(userId: string, now: Date = new Date()): Promise<KlaerungCard[]> {
  const heuteStart = startOfDayBerlin(now);
  const morgenEnde = new Date(heuteStart.getTime() + 2 * 86_400_000);
  /*
   * Geburtstage brauchen mehr Vorlauf als Betreuungsfragen — sonst kommt die
   * Frage nach einem Geschenk zu spät, um sie noch beantworten zu können.
   * Deshalb ein größeres Fenster für dieselbe Abfrage, statt einer zweiten:
   * Die Kalenderdaten sind teuer genug, dass sich zwei Läufe nicht lohnen.
   */
  const vorschauEnde = new Date(heuteStart.getTime() + (VORLAUF_TAGE + 1) * 86_400_000);
  const todayKey = dayKey(now);

  const [{ occurrences, careByOcc }, abgewinkt, offeneAnfragen] = await Promise.all([
    getRangeData(now, vorschauEnde),
    getDismissedTitleKeys(),
    getOpenRequestsForUser(userId),
  ]);

  const wann = (start: Date, allDay: boolean) => wannLabel(start, allDay, now);
  /*
   * „Mi bis So" statt „Mi". Bei einem Balken über mehrere Tage ist der erste
   * Tag die halbe Auskunft — und die Frage, ob ihr weg seid, hängt an der
   * ganzen Spanne.
   */
  const tagLabel = (k: string) =>
    k === todayKey ? "heute" : formatWeekday(new Date(`${k}T12:00:00Z`));
  const spanne = (o: Occurrence) => {
    const tage = tageEinesVorkommens(o);
    return tage.length > 1
      ? `${tagLabel(tage[0])} bis ${tagLabel(tage[tage.length - 1])}`
      : tagLabel(tage[0]);
  };

  // Unbesprochene Betreuung heute/morgen.
  const betreuung: Extract<KlaerungCard, { kind: "betreuung" }>[] = [];
  for (const o of occurrences) {
    if (o.end <= now) continue;
    // Das Fenster reicht jetzt weiter, die Betreuungsfrage aber weiterhin nur
    // bis morgen: Was übermorgen ist, gehört in den Überblick, nicht in eine
    // Unterbrechung beim Öffnen.
    if (o.start >= morgenEnde) continue;
    const c = careByOcc.get(`${o.uid}:${dayKey(o.start)}`);
    if (c) continue;
    const gap = isCareGap(
      { uid: o.uid, title: o.summary, start: o.start, end: o.end, allDay: o.allDay, hasCareDecision: false },
      abgewinkt,
    );
    if (gap) {
      betreuung.push({
        kind: "betreuung",
        uid: o.uid,
        title: o.summary,
        when: wann(o.start, o.allDay),
        occurrenceISO: o.start.toISOString(),
      });
    }
  }

  // Anfragen an mich (Ja/Nein direkt wischbar; alles andere führt zur Anfrage).
  const anfragenRoh = offeneAnfragen.filter((r) => r.type === "yes_no");

  // Die Frage kann weiter vorausgreifen als die zwei Tage oben — der Termin
  // dazu wird deshalb eigens nachgeschlagen.
  const terminLabels = await terminLabelsFuerAnfragen(anfragenRoh, now);

  const anfragen: Extract<KlaerungCard, { kind: "anfrage" }>[] = anfragenRoh.map((r) => ({
    kind: "anfrage" as const,
    id: r.id,
    question: r.question,
    fromName: r.fromUser.name ?? notnameAusEmail(r.fromUser.email),
    eventUid: r.eventUid,
    when: terminLabels.get(r.id) ?? null,
  }));

  // Eskalation: eine Betreuungsanfrage wurde mit Nein beantwortet und die
  // Betreuung ist weiterhin offen — ihr könnt beide nicht. Das darf nicht im
  // System verschwinden, sonst wäre es schlimmer, als nie gefragt zu haben.
  const neinAntworten = await prisma.request.findMany({
    where: { status: "answered", eventUid: { not: null }, type: "yes_no" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { eventUid: true, answer: true },
  });
  const neinUids = new Set(
    neinAntworten.filter((r) => (r.answer ?? "").trim().toLowerCase() === "nein").map((r) => r.eventUid!),
  );
  const eskalationen: Extract<KlaerungCard, { kind: "eskalation" }>[] = [];
  if (neinUids.size) {
    const offen = await prisma.careAssignment.findMany({
      where: { eventUid: { in: [...neinUids] }, status: "offen", occurrenceDate: { gte: heuteStart, lt: morgenEnde } },
    });
    // Wer „Frag ich heute Abend" gewählt hat, hat einen Plan — solange die
    // Aufgabe offen ist, nervt die Karte nicht noch einmal. Wird die Aufgabe
    // erledigt oder gelöscht, ohne dass die Betreuung geklärt ist, kommt die
    // Karte als Sicherheitsnetz wieder.
    const frageKeys = offen.map((a) => `care-frage:${a.eventUid}:${dayKey(a.occurrenceDate)}`);
    const geplant = frageKeys.length
      ? new Set(
          (
            await prisma.todo.findMany({
              where: { sourceUid: { in: frageKeys }, status: "offen" },
              select: { sourceUid: true },
            })
          ).map((t) => t.sourceUid!),
        )
      : new Set<string>();
    for (const a of offen) {
      if (geplant.has(`care-frage:${a.eventUid}:${dayKey(a.occurrenceDate)}`)) continue;
      const occ = occurrences.find((o) => o.uid === a.eventUid && dayKey(o.start) === dayKey(a.occurrenceDate));
      eskalationen.push({
        kind: "eskalation",
        uid: a.eventUid,
        title: occ?.summary ?? "Termin",
        when: occ ? wann(occ.start, occ.allDay) : "heute",
        occurrenceISO: occ ? occ.start.toISOString() : null,
      });
    }
  }
  // Termine mit Eskalation nicht doppelt als Lücke zeigen.
  const eskUids = new Set(eskalationen.map((e) => e.uid));

  // Aufgaben für heute, Überfälliges zuerst.
  const heuteEnde = new Date(heuteStart.getTime() + 86_400_000);
  // Die Kennung als letztes Kriterium: Bei gleicher Fälligkeit entschiede
  // sonst die physische Lage der Zeile, und `take` griffe je nach letzter
  // Änderung andere Aufgaben heraus — der Stapel zeigte andere Karten.
  const rows = await prisma.todo.findMany({
    where: { status: "offen", dueDate: { not: null, lt: heuteEnde } },
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    take: 20,
  });
  const aufgaben: Extract<KlaerungCard, { kind: "aufgabe" }>[] = rows.map((t) => ({
    kind: "aufgabe" as const,
    id: t.id,
    title: t.title,
    dueLabel: t.dueDate ? dueFmt.format(t.dueDate) : null,
    overdue: !!t.dueDate && dayKey(t.dueDate) < todayKey,
    shiftCount: t.shiftCount,
  }));

  // Sonntag ist Aufräumtag: Was ohne Termin liegt, bekommt einmal die Woche
  // die Frage „diese Woche?". Ohne dieses Ritual wird der Parkplatz zum
  // Friedhof — und eine Aufgabe ohne Plan kostet weiter Kopf.
  let parken: Extract<KlaerungCard, { kind: "parken" }>[] = [];
  if (berlinWeekday(now) === 6) {
    const ohneTermin = await prisma.todo.findMany({
      where: { status: "offen", dueDate: null },
      orderBy: [{ important: "desc" }, { createdAt: "asc" }, { id: "asc" }],
      take: 3,
    });
    parken = ohneTermin.map((t) => ({
      kind: "parken" as const,
      id: t.id,
      title: t.title,
      important: t.important,
    }));
  }

  /*
   * Geburtstage: fragen, solange man noch etwas tun kann.
   *
   * Kein Modell im Spiel — erkennen, rechnen, fragen. Wer einmal „nein" sagt,
   * wird für diese Person nie wieder gefragt; bei vierzig Einträgen aus dem
   * Adressbuch wäre die Frage sonst eine Zumutung. Und wer schon eine Aufgabe
   * dafür hat, auch nicht: Die Frage wäre beantwortet.
   */
  const geburtstage = occurrences.filter(
    (o) => o.allDay && istGeburtstag(o.summary) && istImFragefenster(o.start, now),
  );
  const geschenke: Extract<KlaerungCard, { kind: "geschenk" }>[] = [];
  if (geburtstage.length) {
    const keys = [...new Set(geburtstage.map((o) => titelSchluessel(o.summary)))];
    const [regeln, schonGeplant] = await Promise.all([
      prisma.titelRegel.findMany({
        where: { art: "geschenk", titleKey: { in: keys } },
        select: { titleKey: true, entscheidung: true },
      }),
      prisma.todo.findMany({
        where: { sourceUid: { in: geburtstage.map((o) => `geschenk:${o.uid}:${dayKey(o.start)}`) } },
        select: { sourceUid: true },
      }),
    ]);
    const entschieden = new Map(regeln.map((r) => [r.titleKey, r.entscheidung]));
    const geplant = new Set(schonGeplant.map((t) => t.sourceUid!));
    for (const o of geburtstage) {
      const key = titelSchluessel(o.summary);
      if (entschieden.get(key) === "nein") continue;
      if (geplant.has(`geschenk:${o.uid}:${dayKey(o.start)}`)) continue;
      geschenke.push({
        kind: "geschenk",
        titleKey: key,
        eventUid: o.uid,
        title: o.summary,
        person: personAusTitel(o.summary),
        when: wann(o.start, true),
        geburtstagISO: o.start.toISOString(),
      });
    }
  }

  /*
   * Mehrtägiges, das die KI nicht einordnen konnte.
   *
   * Was sie einordnen konnte, wird nicht gefragt: „Mallorca" ist eine
   * Wegfahrt, „Sprung 2" ein Zustand, und eine Frage, deren Antwort schon
   * feststeht, ist keine Klärung. Fehlt die Einordnung ganz — kein Modell,
   * ein gescheiterter Aufruf —, wird ebenfalls nicht gefragt: Lieber keine
   * Frage als eine zu jedem Balken im Kalender.
   */
  const mehrtaegig = occurrences.filter(
    (o) => o.end > now && kommtInFrage(o.allDay, tageEinesVorkommens(o).length),
  );
  const abwesenheiten: Extract<KlaerungCard, { kind: "abwesenheit" }>[] = [];
  if (mehrtaegig.length) {
    const keys = [...new Set(mehrtaegig.map((o) => titelSchluessel(o.summary)))];
    const regeln = await prisma.titelRegel.findMany({
      where: { art: { in: [ABWESENHEIT_ART, EINORDNUNG_ART] }, titleKey: { in: keys } },
      select: { art: true, titleKey: true, entscheidung: true },
    });
    const mensch = new Map(
      regeln.filter((r) => r.art === ABWESENHEIT_ART).map((r) => [r.titleKey, r.entscheidung]),
    );
    const maschine = new Map(
      regeln.filter((r) => r.art === EINORDNUNG_ART).map((r) => [r.titleKey, r.entscheidung]),
    );
    const gesehen = new Set<string>();
    for (const o of mehrtaegig) {
      const key = titelSchluessel(o.summary);
      if (gesehen.has(key)) continue;
      if (!brauchtFrage(mensch.get(key), maschine.get(key))) continue;
      gesehen.add(key);
      abwesenheiten.push({
        kind: "abwesenheit",
        titleKey: key,
        title: o.summary,
        when: spanne(o),
        beginnISO: o.start.toISOString(),
      });
    }
  }

  return buildStack({
    eskalationen,
    anfragen,
    betreuung: betreuung.filter((b) => !eskUids.has(b.uid)),
    aufgaben,
    parken,
    abwesenheiten,
    geschenke,
  });
}

/** Zahl für die rote Markierung am Aufgaben-Tab: heute fällig oder überfällig. */
export async function countTodosDueToday(now: Date = new Date()): Promise<number> {
  const heuteEnde = new Date(startOfDayBerlin(now).getTime() + 86_400_000);
  return prisma.todo.count({ where: { status: "offen", dueDate: { not: null, lt: heuteEnde } } });
}
