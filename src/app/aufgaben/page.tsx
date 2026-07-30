import { auth } from "@/auth";
import { personForEmail } from "@/lib/auth/allowlist";
import { listTodos } from "@/lib/todos/repository";
import { buildTodoVM, groupTodos } from "@/lib/todos/group";
import { AufgabenClient } from "./AufgabenClient";

export const dynamic = "force-dynamic";

/** Aufgaben: gemeinsame To-Dos, sortiert nach ETA und Verantwortlichen. */
export default async function AufgabenPage() {
  const session = await auth();
  const me = personForEmail(session?.user?.email ?? "");

  const now = new Date();
  const rows = await listTodos();
  const groups = groupTodos(rows.map((r) => buildTodoVM(r, now)), now);

  return <AufgabenClient groups={groups} me={me} />;
}
