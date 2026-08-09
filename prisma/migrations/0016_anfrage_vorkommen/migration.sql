-- Um welches Vorkommen geht die Frage?
--
-- Eine Betreuungsfrage hing bisher nur an der Termin-Kennung. Bei einem
-- Einzeltermin geht das gut. Bei einer Serie („jeden Dienstag Physio") nicht:
-- Kommt die Antwort, nahm die App die ERSTE offene Betreuung zu diesem Termin
-- — nicht die, um die gefragt wurde. Wer für den 19. gefragt hat und ein „Ja"
-- bekam, hatte plötzlich den 12. geklärt und den 19. weiter offen.
--
-- Leer heißt weiterhin „gilt für den Termin allgemein"; so bleiben Anfragen
-- lesbar, die vor dieser Migration entstanden sind.

ALTER TABLE "requests" ADD COLUMN "occurrence_date" TIMESTAMP(3);

-- Bestehende offene Betreuungsfragen bekommen genau das Vorkommen, das die
-- Antwort bisher getroffen hätte. Damit ändert sich für sie nichts — sie sind
-- nur ab jetzt eindeutig.
UPDATE "requests" r
SET "occurrence_date" = (
  SELECT MIN(c."occurrenceDate")
  FROM "care_assignments" c
  WHERE c."eventUid" = r."eventUid" AND c."status" = 'offen'
)
WHERE r."status" = 'open'
  AND r."type" = 'yes_no'
  AND r."eventUid" IS NOT NULL;

-- Die Frage nach „gibt es dazu schon eine offene Anfrage?" läuft über beides.
CREATE INDEX "requests_event_occurrence_idx"
  ON "requests" ("eventUid", "occurrence_date", "status");
