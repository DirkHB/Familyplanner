-- Die Seed-Daten aus 0009 und 0010 gehören genau einem Haushalt: unserem.
--
-- 0010 legt 49 private Aufgaben an („Fleurop Inka & Christian", „E-Mail an
-- Frau Sawatzki"), 0009 vier Läden, darunter „Käfer" und „Ali". Auf einer
-- frischen Datenbank liefen beide vollständig durch — ein neuer Haushalt
-- fände am ersten Tag unsere Erledigungen vor.
--
-- Warum eine eigene Migration statt einer Korrektur in 0009/0010: Prisma
-- vergleicht die Prüfsumme angewandter Migrationen. Wer sie nachträglich
-- ändert, bricht das Ausrollen auf jeder Datenbank, die sie schon hat.
--
-- Die Unterscheidung ist „hat sich hier je jemand angemeldet?". Nutzerzeilen
-- entstehen erst beim ersten Login; eine frische Installation hat also keine,
-- unsere Datenbank hat zwei. Das ist der einzige Unterschied, den SQL zu
-- diesem Zeitpunkt sehen kann — und er trifft genau zu.

DELETE FROM "todos"
  WHERE "id" LIKE 'td_seed_%'
    AND NOT EXISTS (SELECT 1 FROM "users");

DELETE FROM "todo_lists"
  WHERE "id" LIKE 'tdl_seed_%'
    AND NOT EXISTS (SELECT 1 FROM "users");

DELETE FROM "stores"
  WHERE "id" LIKE 'str_seed_%'
    AND NOT EXISTS (SELECT 1 FROM "users");
