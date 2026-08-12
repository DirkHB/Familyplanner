-- Googles eigene Kennung für einen Termin.
--
-- Die UID gehört uns (wir legen über events.import an, das eine mitgebrachte
-- UID annimmt). Zum Ändern und Löschen will Googles API aber ihre eigene
-- Kennung sehen, und die lässt sich aus der UID nicht ableiten — bei
-- importierten Terminen stimmt die verbreitete Annahme "id@google.com" nicht.
--
-- Deshalb eine Spalte statt einer Ableitung: leer bei iCloud, gefüllt bei
-- Google. Raten wäre hier eine Fehlerquelle, die erst beim Löschen auffällt.
ALTER TABLE "events" ADD COLUMN "provider_event_id" TEXT;
