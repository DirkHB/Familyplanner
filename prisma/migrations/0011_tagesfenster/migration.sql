-- Tagesfenster je Person für den Zeitstrahl (Standard 7-21, wenn leer).
ALTER TABLE "users" ADD COLUMN "tag_von_stunde" INTEGER;
ALTER TABLE "users" ADD COLUMN "tag_bis_stunde" INTEGER;
