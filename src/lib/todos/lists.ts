import "server-only";
import { prisma } from "@/lib/prisma";
import { normalizeName, nameVergeben } from "@/lib/names";

/** Aufgabenlisten pflegen — dieselben Regeln wie bei den Läden. */

export async function listTodoLists() {
  return prisma.todoList.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
}

export async function createTodoList(name: string): Promise<{ ok: boolean; grund?: string; id?: string }> {
  const sauber = normalizeName(name);
  if (!sauber) return { ok: false, grund: "Die Liste braucht einen Namen." };
  const vorhandene = await listTodoLists();
  const schon = vorhandene.find(
    (l) => normalizeName(l.name).toLowerCase() === sauber.toLowerCase(),
  );
  // Beim Übernehmen aus iCloud kommt derselbe Name schnell zweimal vorbei.
  // Dann ist die vorhandene Liste die richtige Antwort, kein Fehler.
  if (schon) return { ok: true, id: schon.id };
  const letzte = vorhandene[vorhandene.length - 1];
  const angelegt = await prisma.todoList.create({
    data: { name: sauber, sortOrder: (letzte?.sortOrder ?? -1) + 1 },
  });
  return { ok: true, id: angelegt.id };
}

export async function renameTodoList(
  id: string,
  name: string,
): Promise<{ ok: boolean; grund?: string }> {
  const sauber = normalizeName(name);
  if (!sauber) return { ok: false, grund: "Die Liste braucht einen Namen." };
  const andere = (await listTodoLists()).filter((l) => l.id !== id);
  if (nameVergeben(sauber, andere.map((l) => l.name)))
    return { ok: false, grund: `„${sauber}" gibt es schon.` };
  await prisma.todoList.update({ where: { id }, data: { name: sauber } }).catch(() => null);
  return { ok: true };
}

/**
 * Liste löschen. Die Aufgaben bleiben und rutschen nach „Ohne Liste" — der
 * Fremdschlüssel geht auf NULL. Eine Liste zu löschen ist eine Aussage über
 * die Ordnung, nicht über die Arbeit, die noch ansteht.
 */
export async function deleteTodoList(id: string) {
  return prisma.todoList.delete({ where: { id } }).catch(() => null);
}

/** Wie viele offene Aufgaben hängen an jeder Liste? Für die Einstellungen. */
export async function countOpenPerList(): Promise<Map<string | null, number>> {
  const rows = await prisma.todo.groupBy({
    by: ["listId"],
    where: { status: "offen" },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.listId, r._count._all]));
}
