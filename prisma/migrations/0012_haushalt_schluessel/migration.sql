-- Haushalt als Bestandteil der beiden Eindeutigkeiten, die sonst über
-- Haushalte hinweg kollidieren würden.
--
-- `care_rules.title_key` war global eindeutig: Winkt ein Haushalt
-- „Schwimmkurs" ab, wäre die Regel bei allen anderen mitgesetzt.
-- `briefings` erlaubte genau ein Briefing je Art und Tag — für die ganze
-- Datenbank, nicht je Haushalt.
--
-- Heute gehört jede Datenbank genau einem Haushalt, deshalb die Vorgabe '1'.
-- Der Zweck ist, dass die spätere Migration etwas HINZUFÜGT statt eine
-- Eindeutigkeit auf laufenden Daten umzubauen — das ist der unangenehme Teil.

ALTER TABLE "care_rules" ADD COLUMN "household_id" TEXT NOT NULL DEFAULT '1';
ALTER TABLE "briefings" ADD COLUMN "household_id" TEXT NOT NULL DEFAULT '1';

DROP INDEX "care_rules_title_key_key";
CREATE UNIQUE INDEX "care_rules_household_id_title_key_key"
  ON "care_rules"("household_id", "title_key");

DROP INDEX "briefings_kind_dayKey_key";
CREATE UNIQUE INDEX "briefings_household_id_kind_dayKey_key"
  ON "briefings"("household_id", "kind", "dayKey");
