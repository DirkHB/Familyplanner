-- Zu welchem Kalenderblock gehört diese Betreuung?
--
-- Bisher ergab sich die Block-UID aus Termin und Tag, also ließ sie sich
-- zurückrechnen. Seit ein Block mehrere überlappende Betreuungen zusammenfasst
-- ("Constanze ist von 11:35 bis 12:35 da" statt zweimal derselbe Eintrag),
-- geht das nicht mehr: Aus der UID lässt sich nicht ablesen, welche
-- Betreuungen darin stecken.
--
-- Deshalb die Zuordnung ausschreiben. Leer heißt: Diese Betreuung hat gerade
-- keinen Block im Kalender — weil sie offen ist, weil niemand sie übernommen
-- hat, oder weil die Blöcke abgeschaltet sind.

ALTER TABLE "care_assignments" ADD COLUMN "block_uid" TEXT;

CREATE INDEX "care_assignments_block_uid_idx" ON "care_assignments" ("block_uid");
