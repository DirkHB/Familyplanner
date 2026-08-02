import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto/envelope";
import { createICloudClient } from "@/lib/calendar/tsdav-client";
import { parseTodos, type ParsedTodo } from "@/lib/calendar/vtodo";
import { createTodoList } from "./lists";
import type { Person } from "@/lib/auth/allowlist";

/**
 * Erinnerungen aus iCloud übernehmen — einmalig (Variante B).
 *
 * Bewusst kein Abgleich in beide Richtungen: Danach leben die Aufgaben in der
 * App. Deshalb wird auch nichts in iCloud verändert oder gelöscht — die Liste
 * dort bleibt unangetastet, bis ihr sie selbst aufräumt. Ein Import, der beim
 * ersten Versuch etwas kaputt macht, wäre nicht zu reparieren.
 */

export type RemindersList = {
  /** Die CalDAV-Adresse der Liste — zugleich ihre Kennung beim Übernehmen. */
  url: string;
  name: string;
  offen: number;
  erledigt: number;
  /** true, wenn diese Liste (unter diesem Namen) schon einmal übernommen wurde. */
  schonUebernommen: boolean;
};

async function icloud() {
  const account = await prisma.calendarAccount.findFirst({ where: { provider: "icloud" } });
  if (!account) return null;
  const password = decryptSecret(account.credentialsEncrypted);
  return createICloudClient({ username: account.username ?? "", password });
}

/**
 * Welche Erinnerungslisten liegen im Konto?
 *
 * Erkannt werden sie am Inhalt, nicht am Namen: Eine Sammlung, in der VTODOs
 * stehen, ist eine Erinnerungsliste. Kalender fallen damit von selbst heraus.
 */
export async function discoverRemindersLists(): Promise<RemindersList[]> {
  const client = await icloud();
  if (!client) return [];

  const [sammlungen, vorhandeneListen] = await Promise.all([
    client.discoverCalendars(),
    prisma.todoList.findMany({ select: { name: true } }),
  ]);
  const bekannt = new Set(vorhandeneListen.map((l) => l.name.toLowerCase()));

  const out: RemindersList[] = [];
  for (const s of sammlungen) {
    let offen = 0;
    let erledigt = 0;
    let hatTodos = false;
    try {
      const { objects } = await client.fetchChanges(s.url);
      for (const o of objects) {
        for (const t of parseTodos(o.ics)) {
          hatTodos = true;
          if (t.done) erledigt++;
          else offen++;
        }
      }
    } catch {
      continue; // Eine unlesbare Sammlung überspringen, nicht alles abbrechen.
    }
    if (!hatTodos) continue;
    out.push({
      url: s.url,
      name: s.displayName,
      offen,
      erledigt,
      schonUebernommen: bekannt.has(s.displayName.toLowerCase()),
    });
  }
  return out.sort((a, b) => b.offen - a.offen);
}

export type ImportResult = {
  ok: boolean;
  grund?: string;
  listenName?: string;
  uebernommen: number;
  uebersprungen: number;
};

/**
 * Eine Erinnerungsliste übernehmen.
 *
 * Erledigtes bleibt draußen — es würde nur das Fach „Erledigt" fluten, ohne
 * dass jemand etwas davon hat. Und was schon einmal übernommen wurde, kommt
 * nicht doppelt: Dafür merkt sich jede Aufgabe die Herkunfts-Kennung aus
 * iCloud. Zweimal auf den Knopf zu tippen darf nichts anrichten.
 */
export async function importRemindersList(
  url: string,
  createdBy: Person,
): Promise<ImportResult> {
  const client = await icloud();
  if (!client) return { ok: false, grund: "Kein iCloud-Konto verbunden.", uebernommen: 0, uebersprungen: 0 };

  const sammlung = (await client.discoverCalendars()).find((c) => c.url === url);
  if (!sammlung)
    return { ok: false, grund: "Diese Liste gibt es nicht mehr.", uebernommen: 0, uebersprungen: 0 };

  let objects;
  try {
    ({ objects } = await client.fetchChanges(url));
  } catch {
    return { ok: false, grund: "Liste konnte nicht gelesen werden.", uebernommen: 0, uebersprungen: 0 };
  }

  const offene: ParsedTodo[] = [];
  for (const o of objects) {
    for (const t of parseTodos(o.ics)) {
      if (!t.done && t.summary) offene.push(t);
    }
  }

  const liste = await createTodoList(sammlung.displayName);
  if (!liste.ok || !liste.id)
    return { ok: false, grund: liste.grund ?? "Liste konnte nicht angelegt werden.", uebernommen: 0, uebersprungen: 0 };

  // Was schon da ist, bleibt wie es ist — auch wenn es in iCloud inzwischen
  // anders heißt. Der Import ist eine Übernahme, kein Abgleich.
  const schonDa = new Set(
    (
      await prisma.todo.findMany({
        where: { sourceUid: { in: offene.map((t) => t.uid).filter(Boolean) } },
        select: { sourceUid: true },
      })
    ).map((r) => r.sourceUid),
  );

  let uebernommen = 0;
  let uebersprungen = 0;
  for (const t of offene) {
    if (t.uid && schonDa.has(t.uid)) {
      uebersprungen++;
      continue;
    }
    await prisma.todo.create({
      data: {
        title: t.summary,
        notes: t.notes,
        dueDate: t.dueDate,
        listId: liste.id,
        createdBy,
        sourceUid: t.uid || null,
      },
    });
    uebernommen++;
  }

  return { ok: true, listenName: sammlung.displayName, uebernommen, uebersprungen };
}
