-- Betreuung ist keine Aufgabe, sondern eine Zusage fuer ein Zeitfenster.
-- Die bisher automatisch erzeugten Aufgaben "Baby betreuen · <Termin>"
-- werden nicht mehr angelegt; die vorhandenen raeumen wir hier weg.
-- Die Betreuung selbst bleibt unberuehrt: Sie steht in care_assignments.
DELETE FROM "todos"
WHERE "eventUid" IS NOT NULL
  AND "title" LIKE 'Baby betreuen · %';
