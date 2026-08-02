"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { personForEmail } from "@/lib/auth/allowlist";
import { createEvent } from "@/lib/calendar/create";
import { berlinStunde } from "@/lib/calendar/zeitstrahl";

/**
 * Termin direkt aus der Monatsansicht anlegen — zweiter Tipp auf einen Tag.
 * Schreibt echt in den iCloud-Kalender (derselbe Weg wie Erfassen und Ideen).
 */
export async function neuerTerminAction(input: {
  titel: string;
  tag: string; // YYYY-MM-DD (Berlin)
  von: string; // HH:MM
  bis: string; // HH:MM
}): Promise<{ ok: boolean; grund?: string }> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return { ok: false, grund: "Nicht angemeldet." };

  const titel = input.titel.trim();
  if (!titel) return { ok: false, grund: "Der Termin braucht einen Titel." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.tag)) return { ok: false, grund: "Ohne Tag geht es nicht." };

  const zeit = (raw: string): Date | null => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(raw);
    if (!m) return null;
    // DST-fest über den Stunden-Anker; Minuten obendrauf.
    return new Date(berlinStunde(input.tag, Number(m[1])).getTime() + Number(m[2]) * 60_000);
  };
  const start = zeit(input.von);
  const end = zeit(input.bis);
  if (!start || !end) return { ok: false, grund: "Uhrzeit bitte als HH:MM." };
  if (end <= start) return { ok: false, grund: "Das Ende liegt vor dem Anfang." };

  const res = await createEvent(session.user.id, {
    title: titel,
    start,
    end,
    allDay: false,
    createdBy: personForEmail(session.user.email),
  });
  if (!res.created) return { ok: false, grund: res.reason ?? "Anlegen fehlgeschlagen." };

  revalidatePath("/termine");
  revalidatePath("/woche");
  return { ok: true };
}
