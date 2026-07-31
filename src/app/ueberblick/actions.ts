"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { takeCare } from "@/lib/care/repository";
import { dismissTitle } from "@/lib/care/rules";
import { invalidateKalender } from "@/lib/calendar/range-data";

/** Betreuung direkt aus dem Überblick übernehmen — ohne Umweg über den Termin. */
export async function takeCareFromOverviewAction(uid: string, occurrenceISO: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await takeCare(uid, new Date(occurrenceISO), session.user.id);
  invalidateKalender();
  revalidatePath("/ueberblick");
  revalidatePath("/woche");
  return { ok: true };
}

/**
 * „Dafür braucht es nie eine Betreuung." Gilt ab sofort für alle Termine
 * dieses Titels — die wöchentliche Müllabfuhr fragt also nur einmal.
 */
export async function dismissCareTitleAction(title: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await dismissTitle(title, session.user.id);
  invalidateKalender();
  revalidatePath("/ueberblick");
  revalidatePath("/woche");
  return { ok: true };
}
