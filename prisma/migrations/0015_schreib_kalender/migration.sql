-- In welchen Kalender trägt die App für diese Person ein?
--
-- Bisher nahm sie den erstbesten: das eigene Konto, wenn eines da war, sonst
-- irgendeines des Haushalts — und darin den alphabetisch ersten Kalender.
-- Für uns fiel das nie auf, wir teilen einen. Für einen Haushalt, in dem jeder
-- seinen eigenen Kalender mitbringt, heißt es: Wer selbst kein Konto verbunden
-- hat, schreibt in den Kalender des anderen. Termine landeten also bei einem
-- Menschen, der sie nie eingetragen hat.
--
-- Leer heißt weiterhin „nimm den erstbesten". Niemand muss etwas festlegen,
-- damit es weiterläuft; wer es festlegt, bestimmt es.

ALTER TABLE "users" ADD COLUMN "schreib_kalender_id" TEXT;
