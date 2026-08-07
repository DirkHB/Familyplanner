-- Welchen Platz im Haushalt hat diese Person?
--
-- Bisher entschied das eine feste E-Mail-Adresse im Code: Genau eine Adresse
-- war „dirk", jede andere wurde „constanze". In einem zweiten Haushalt wären
-- damit beide dieselbe Person gewesen.
--
-- Die beiden Werte sind historisch gewachsen und stehen so in Aufgaben,
-- Einkauf und Verlauf. Sie bedeuten hier nur noch „Platz A" und „Platz B";
-- welcher Name dazu angezeigt wird, steht in users.name.
--
-- Die Zuordnung wird exakt nach der bisherigen Regel übernommen, damit sich
-- an unseren vorhandenen Zuordnungen nichts verschiebt.

ALTER TABLE "users" ADD COLUMN "slot" TEXT;

UPDATE "users" SET "slot" = 'dirk'
  WHERE lower("email") = 'dirkbrederecke@gmail.com';
UPDATE "users" SET "slot" = 'constanze'
  WHERE "slot" IS NULL;
