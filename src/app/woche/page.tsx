import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { WeekView } from "@/components/week/WeekView";
import { buildWeek } from "@/lib/calendar/view-model";
import { getRangeData } from "@/lib/calendar/range-data";
import { startOfDayBerlin, formatDateHeader, greetingFor, dayKey } from "@/lib/calendar/format";
import { displayNameForEmail } from "@/lib/auth/allowlist";
import { getOpenRequestsForUser } from "@/lib/requests/repository";
import { getKlaerungStack } from "@/lib/klaerung/repository";
import { KlaerungGate } from "@/components/klaerung/KlaerungGate";
import { buildRequestVM } from "@/lib/requests/view-model";
import { STANDARD_FENSTER } from "@/lib/calendar/zeitstrahl";
import { getOverview, defaultHorizon } from "@/lib/overview/repository";
import { briefingText } from "@/lib/overview/build";

export const dynamic = "force-dynamic";

/** Startbildschirm: Heute-Fokus + vertikale Wochenliste (Abschnitt 6.1). */
export default async function WochePage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const session = await auth();
  const name = displayNameForEmail(session?.user?.email);

  const now = new Date();
  // ?w=1 blättert eine Woche vor — der Nachfolger des alten Überblick-Umschalters.
  const naechste = (await searchParams).w === "1";
  const from = new Date(startOfDayBerlin(now).getTime() + (naechste ? 7 * 86_400_000 : 0));
  const to = new Date(from.getTime() + (naechste ? 7 : 10) * 86_400_000);

  // Tagesfenster der angemeldeten Person — der Zeitstrahl rechnet damit.
  const ich = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { tagVonStunde: true, tagBisStunde: true },
      })
    : null;
  const fenster =
    ich?.tagVonStunde != null && ich?.tagBisStunde != null
      ? { vonStunde: ich.tagVonStunde, bisStunde: ich.tagBisStunde }
      : STANDARD_FENSTER;

  const { occurrences, metaByUid, careByOcc } = await getRangeData(from, to);
  const days = buildWeek(occurrences, metaByUid, now, careByOcc, fenster);

  const requests = session?.user?.id
    ? (await getOpenRequestsForUser(session.user.id)).map((r) => buildRequestVM(r, now))
    : [];

  // Das Briefing wohnte im Überblick; jetzt steht es hier im Kopf — dort,
  // wo man ohnehin zuerst hinschaut. Immer live gerechnet, nie von 7 Uhr.
  const briefing = session?.user?.id
    ? await getOverview(defaultHorizon(now), now)
        .then((o) => briefingText(o, "morgen"))
        .catch(() => null)
    : null;

  // Nächster noch anstehender Termin heute — wird in der Liste hervorgehoben.
  // Eine eigene „Heute"-Karte gab es hier einmal; sie zeigte denselben Termin
  // ein zweites Mal direkt über der Liste und ist ersatzlos entfallen.
  const todayKey = dayKey(now);
  const nextToday = occurrences
    .filter((o) => dayKey(o.start) === todayKey && !o.allDay && o.end >= now)
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
  // Gleiche Bildung wie in buildWeek — sonst greift die Hervorhebung ins Leere.
  const nextTodayKey = nextToday ? `${nextToday.uid}:${nextToday.recurrenceId}` : null;

  // Klärungs-Stapel: nur hier auf der Woche, nie über einem Direkteinstieg.
  const stack = session?.user?.id && !naechste ? await getKlaerungStack(session.user.id, now) : [];

  return (
    <>
      <WeekView
        greetingName={name}
        greeting={greetingFor(now)}
        dateLabel={formatDateHeader(now)}
        days={days}
        requests={requests}
        nextTodayKey={naechste ? null : nextTodayKey}
        fenster={fenster}
        briefing={briefing}
        naechsteWoche={naechste}
      />
      {!naechste && <KlaerungGate cards={stack} todayKey={todayKey} />}
    </>
  );
}
