-- Einmal fragen, Antwort merken — für alles außer Betreuung.
--
-- Für die Betreuung gibt es dieses Muster längst (care_rules): Die Antwort
-- gilt nicht für ein einzelnes Vorkommen, sondern für die Art des Eintrags.
-- Wer einmal gesagt hat „für Sport brauchen wir keine Betreuung", soll nicht
-- jede Woche erneut gefragt werden.
--
-- Jetzt stellen sich zwei weitere Fragen derselben Bauart: „Seid ihr da weg?"
-- bei mehrtägigen Einträgen und „Geschenk besorgen?" bei Geburtstagen. Statt
-- zwei fast gleiche Tabellen daneben zu stellen, eine mit einer Spalte für die
-- Art der Frage.
CREATE TABLE "titel_regeln" (
  "id"           TEXT NOT NULL,
  "household_id" TEXT NOT NULL DEFAULT 'KEIN_HAUSHALT',
  -- "abwesenheit" | "geschenk"
  "art"          TEXT NOT NULL,
  "title_key"    TEXT NOT NULL,
  -- "ja" | "nein"
  "entscheidung" TEXT NOT NULL,
  "created_by"   TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "titel_regeln_pkey" PRIMARY KEY ("id")
);

-- Eine Antwort je Haushalt, Art und Titel. Der Haushalt steht mit im
-- Schlüssel, weil der Riegel an einen zusammengesetzten Unique nicht
-- herankommt.
CREATE UNIQUE INDEX "titel_regeln_household_id_art_title_key_key"
  ON "titel_regeln"("household_id", "art", "title_key");
CREATE INDEX "titel_regeln_household_id_idx" ON "titel_regeln"("household_id");

ALTER TABLE "titel_regeln" ADD CONSTRAINT "titel_regeln_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
