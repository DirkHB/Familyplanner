import { AufgabenClient } from "@/app/aufgaben/AufgabenClient";
import { buildTodoVM, groupTodos } from "@/lib/todos/group";

export const dynamic = "force-dynamic";

/**
 * Öffentliche Vorschau der Aufgaben mit Beispieldaten.
 *
 * Zeigt vor allem die Listen-Umschalter über den Fächern — die Stelle, an der
 * sich entscheidet, ob zwei Ordnungen übereinander noch lesbar sind.
 */
export default function VorschauAufgaben() {
  const now = new Date();
  const tag = (versatz: number) => new Date(now.getTime() + versatz * 86_400_000);

  const rows = [
    { id: "t1", title: "Kindergeld-Antrag abschicken", notes: null, dueDate: tag(-2), assignee: "dirk", createdBy: "dirk", status: "offen", remindAt: null, important: false, listId: "l3" },
    { id: "t2", title: "Waschmaschine entkalken", notes: null, dueDate: tag(0), assignee: "constanze", createdBy: "dirk", status: "offen", remindAt: null, important: false, listId: "l1" },
    { id: "t3", title: "Kita-Anmeldung ausfüllen", notes: null, dueDate: null, assignee: null, createdBy: "constanze", status: "offen", remindAt: null, important: true, listId: "l2" },
    { id: "t4", title: "Nächste U-Untersuchung buchen", notes: null, dueDate: tag(3), assignee: "constanze", createdBy: "constanze", status: "offen", remindAt: null, important: false, listId: "l2" },
    { id: "t5", title: "Rasen mähen", notes: null, dueDate: null, assignee: "dirk", createdBy: "dirk", status: "offen", remindAt: null, important: false, listId: null },
  ];

  const groups = groupTodos(rows.map((r) => buildTodoVM(r, now)), now);

  return (
    <AufgabenClient
      groups={groups}
      me="dirk"
      einkaufOffen={3}
      todoLists={[
        { id: "l1", name: "Haushalt" },
        { id: "l2", name: "Nicolas" },
        { id: "l3", name: "Papierkram" },
      ]}
    />
  );
}
