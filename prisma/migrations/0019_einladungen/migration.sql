-- Wer darf neue Haushalte einladen?
--
-- Genau einer: der, der die App betreibt. Innerhalb eines Haushalts lädt
-- jeder seine zweite Person selbst ein — dafür braucht es kein Merkmal.
--
-- Der Älteste ist es, weil er der erste war. Das ist keine schöne Regel,
-- aber die einzige, die ohne eine Adresse im Code auskommt.

ALTER TABLE "users" ADD COLUMN "is_admin" BOOLEAN NOT NULL DEFAULT false;

UPDATE "users" SET "is_admin" = true
  WHERE "id" = (SELECT "id" FROM "users" ORDER BY "createdAt" ASC LIMIT 1);
