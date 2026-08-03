import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getRangeData } from "@/lib/calendar/range-data";
import { buildWeek } from "@/lib/calendar/view-model";
import { startOfDayBerlin } from "@/lib/calendar/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Die Termine eines Tages fürs Tages-Blatt im Monatsstrom. Das Raster kennt
 * nur Kurzformen — hier kommen Titel, Zeiten und der Betreuungsstand.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ events: [] }, { status: 401 });

  const d = new URL(req.url).searchParams.get("d");
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return NextResponse.json({ events: [] }, { status: 400 });
  }

  const from = startOfDayBerlin(new Date(`${d}T12:00:00Z`));
  const to = new Date(from.getTime() + 86_400_000);
  const { occurrences, metaByUid, careByOcc } = await getRangeData(from, to);
  const day = buildWeek(occurrences, metaByUid, new Date(), careByOcc).find((g) => g.key === d);

  return NextResponse.json({
    events: (day?.events ?? []).map((ev) => ({
      href: ev.href,
      title: ev.title,
      time: ev.time,
      allDay: ev.allDay,
      dotColor: ev.dotColor,
      care: ev.care ? (ev.care.status === "offen" ? "offen" : "da") : null,
    })),
  });
}
