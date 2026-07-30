import { auth } from "@/auth";
import { WeekView } from "@/components/week/WeekView";
import { buildWeek } from "@/lib/calendar/view-model";
import { getOccurrencesForRange, getMetaByUid } from "@/lib/calendar/repository";
import { startOfDayBerlin, formatDateHeader, greetingFor } from "@/lib/calendar/format";
import { displayNameForEmail } from "@/lib/auth/allowlist";
import { getOpenRequestsForUser } from "@/lib/requests/repository";
import { buildRequestVM } from "@/lib/requests/view-model";

export const dynamic = "force-dynamic";

/** Startbildschirm: vertikale Wochenliste, heute oben (Abschnitt 6.1). */
export default async function WochePage() {
  const session = await auth();
  const name = displayNameForEmail(session?.user?.email);

  const now = new Date();
  const from = startOfDayBerlin(now);
  const to = new Date(from.getTime() + 10 * 86_400_000);

  const occurrences = await getOccurrencesForRange(from, to);
  const uids = [...new Set(occurrences.map((o) => o.uid))];
  const meta = await getMetaByUid(uids);
  const days = buildWeek(occurrences, meta, now);

  const requests = session?.user?.id
    ? (await getOpenRequestsForUser(session.user.id)).map((r) => buildRequestVM(r, now))
    : [];

  return (
    <WeekView
      greetingName={name}
      greeting={greetingFor(now)}
      dateLabel={formatDateHeader(now)}
      days={days}
      requests={requests}
    />
  );
}
