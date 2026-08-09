-- Mehrere Haushalte in einer Datenbank.
--
-- Bis hierher gehörte eine Datenbank genau einem Haushalt, und `haushaltId()`
-- gab die Konstante "1" zurück. Diese Migration macht aus der Konstante eine
-- echte Zeile und hängt jede Zeile, die jemandem gehört, daran.
--
-- Zwei Dinge sind Absicht und wichtig:
--
-- 1. Die Spalte ist NOT NULL und hat KEINEN Vorgabewert. Ein Schreibzugriff,
--    der den Haushalt vergisst, scheitert damit an der Datenbank statt still
--    in einem fremden zu landen. Für Lesezugriffe kann die Datenbank das nicht
--    leisten — dafür gibt es den Riegel in lib/prisma.
-- 2. Der bestehende Bestand bekommt den Haushalt "1". Das ist derselbe Wert,
--    den `EIN_HAUSHALT` bisher zurückgab, und den briefings und care_rules
--    schon als Vorgabe trugen. Damit verschiebt sich für uns nichts.

-- ------------------------------ Haushalte ------------------------------

CREATE TABLE "households" (
  "id"        TEXT NOT NULL,
  "name"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invites" (
  "id"           TEXT NOT NULL,
  "household_id" TEXT,
  "email"        TEXT NOT NULL,
  "token_hash"   TEXT NOT NULL,
  "expires_at"   TIMESTAMP(3) NOT NULL,
  "used_at"      TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "invites_token_hash_key" ON "invites" ("token_hash");
CREATE INDEX "invites_email_idx" ON "invites" ("email");
ALTER TABLE "invites" ADD CONSTRAINT "invites_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unser Haushalt. Die Kennung "1" ist dieselbe, mit der die App bisher
-- gerechnet hat — deshalb passt der ganze Bestand ohne Umschreiben.
INSERT INTO "households" ("id", "name") VALUES ('1', 'Erster Haushalt');

-- ------------------------------- Nutzer -------------------------------

ALTER TABLE "users" ADD COLUMN "household_id" TEXT;
UPDATE "users" SET "household_id" = '1';
ALTER TABLE "users" ALTER COLUMN "household_id" SET NOT NULL;
CREATE INDEX "users_household_id_idx" ON "users" ("household_id");
ALTER TABLE "users" ADD CONSTRAINT "users_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------- Alles, was jemandem gehört ---------------------------

ALTER TABLE "push_subscriptions" ADD COLUMN "household_id" TEXT;
UPDATE "push_subscriptions" SET "household_id" = '1';
ALTER TABLE "push_subscriptions" ALTER COLUMN "household_id" SET NOT NULL;
CREATE INDEX "push_subscriptions_household_id_idx" ON "push_subscriptions" ("household_id");
ALTER TABLE "calendar_accounts" ADD COLUMN "household_id" TEXT;
UPDATE "calendar_accounts" SET "household_id" = '1';
ALTER TABLE "calendar_accounts" ALTER COLUMN "household_id" SET NOT NULL;
CREATE INDEX "calendar_accounts_household_id_idx" ON "calendar_accounts" ("household_id");
ALTER TABLE "calendars" ADD COLUMN "household_id" TEXT;
UPDATE "calendars" SET "household_id" = '1';
ALTER TABLE "calendars" ALTER COLUMN "household_id" SET NOT NULL;
CREATE INDEX "calendars_household_id_idx" ON "calendars" ("household_id");
ALTER TABLE "events" ADD COLUMN "household_id" TEXT;
UPDATE "events" SET "household_id" = '1';
ALTER TABLE "events" ALTER COLUMN "household_id" SET NOT NULL;
CREATE INDEX "events_household_id_idx" ON "events" ("household_id");
ALTER TABLE "event_details" ADD COLUMN "household_id" TEXT;
UPDATE "event_details" SET "household_id" = '1';
ALTER TABLE "event_details" ALTER COLUMN "household_id" SET NOT NULL;
CREATE INDEX "event_details_household_id_idx" ON "event_details" ("household_id");
ALTER TABLE "care_assignments" ADD COLUMN "household_id" TEXT;
UPDATE "care_assignments" SET "household_id" = '1';
ALTER TABLE "care_assignments" ALTER COLUMN "household_id" SET NOT NULL;
CREATE INDEX "care_assignments_household_id_idx" ON "care_assignments" ("household_id");
ALTER TABLE "shopping_lists" ADD COLUMN "household_id" TEXT;
UPDATE "shopping_lists" SET "household_id" = '1';
ALTER TABLE "shopping_lists" ALTER COLUMN "household_id" SET NOT NULL;
CREATE INDEX "shopping_lists_household_id_idx" ON "shopping_lists" ("household_id");
ALTER TABLE "shopping_items" ADD COLUMN "household_id" TEXT;
UPDATE "shopping_items" SET "household_id" = '1';
ALTER TABLE "shopping_items" ALTER COLUMN "household_id" SET NOT NULL;
CREATE INDEX "shopping_items_household_id_idx" ON "shopping_items" ("household_id");
ALTER TABLE "stores" ADD COLUMN "household_id" TEXT;
UPDATE "stores" SET "household_id" = '1';
ALTER TABLE "stores" ALTER COLUMN "household_id" SET NOT NULL;
CREATE INDEX "stores_household_id_idx" ON "stores" ("household_id");
ALTER TABLE "requests" ADD COLUMN "household_id" TEXT;
UPDATE "requests" SET "household_id" = '1';
ALTER TABLE "requests" ALTER COLUMN "household_id" SET NOT NULL;
CREATE INDEX "requests_household_id_idx" ON "requests" ("household_id");
ALTER TABLE "ideas" ADD COLUMN "household_id" TEXT;
UPDATE "ideas" SET "household_id" = '1';
ALTER TABLE "ideas" ALTER COLUMN "household_id" SET NOT NULL;
CREATE INDEX "ideas_household_id_idx" ON "ideas" ("household_id");
ALTER TABLE "learned_patterns" ADD COLUMN "household_id" TEXT;
UPDATE "learned_patterns" SET "household_id" = '1';
ALTER TABLE "learned_patterns" ALTER COLUMN "household_id" SET NOT NULL;
CREATE INDEX "learned_patterns_household_id_idx" ON "learned_patterns" ("household_id");
ALTER TABLE "ai_feedback" ADD COLUMN "household_id" TEXT;
UPDATE "ai_feedback" SET "household_id" = '1';
ALTER TABLE "ai_feedback" ALTER COLUMN "household_id" SET NOT NULL;
CREATE INDEX "ai_feedback_household_id_idx" ON "ai_feedback" ("household_id");
ALTER TABLE "activity_log" ADD COLUMN "household_id" TEXT;
UPDATE "activity_log" SET "household_id" = '1';
ALTER TABLE "activity_log" ALTER COLUMN "household_id" SET NOT NULL;
CREATE INDEX "activity_log_household_id_idx" ON "activity_log" ("household_id");
ALTER TABLE "todo_lists" ADD COLUMN "household_id" TEXT;
UPDATE "todo_lists" SET "household_id" = '1';
ALTER TABLE "todo_lists" ALTER COLUMN "household_id" SET NOT NULL;
CREATE INDEX "todo_lists_household_id_idx" ON "todo_lists" ("household_id");
ALTER TABLE "todos" ADD COLUMN "household_id" TEXT;
UPDATE "todos" SET "household_id" = '1';
ALTER TABLE "todos" ALTER COLUMN "household_id" SET NOT NULL;
CREATE INDEX "todos_household_id_idx" ON "todos" ("household_id");
ALTER TABLE "app_settings" ADD COLUMN "household_id" TEXT;
UPDATE "app_settings" SET "household_id" = '1';
ALTER TABLE "app_settings" ALTER COLUMN "household_id" SET NOT NULL;
CREATE INDEX "app_settings_household_id_idx" ON "app_settings" ("household_id");

-- briefings und care_rules tragen die Spalte schon, aber mit Vorgabewert "1".
-- Der muss weg: Ein vergessener Haushalt soll auffallen, nicht still bei uns
-- landen.
ALTER TABLE "briefings" ALTER COLUMN "household_id" DROP DEFAULT;
ALTER TABLE "care_rules" ALTER COLUMN "household_id" DROP DEFAULT;

-- --------------------------- Der harte Riegel ---------------------------
--
-- Ein Fremdschlüssel auf households. Damit ist ein erfundener Haushalt keine
-- Frage von Sorgfalt mehr, sondern ein Fehler der Datenbank.
--
-- Im Schema steht als Vorgabewert absichtlich "KEIN_HAUSHALT" — ein Wert, den
-- es als Haushalt nie gibt. Er macht die Spalte für Prisma optional (sonst
-- müsste jeder der rund sechzig Schreibzugriffe sie von Hand mitgeben und
-- könnte dabei den falschen erwischen), und wenn er je wirklich geschrieben
-- wird, weil eine Abfrage am Riegel vorbeiging, scheitert sie hier laut statt
-- still in einem fremden Haushalt zu landen.
--
-- ON DELETE CASCADE ist gewollt: Wird ein Haushalt gelöscht, geht alles mit,
-- was ihm gehört. Ohne das bliebe verwaister Bestand liegen, den niemand mehr
-- sieht und der trotzdem da ist.
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendar_accounts" ADD CONSTRAINT "calendar_accounts_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_details" ADD CONSTRAINT "event_details_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "care_assignments" ADD CONSTRAINT "care_assignments_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stores" ADD CONSTRAINT "stores_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "requests" ADD CONSTRAINT "requests_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learned_patterns" ADD CONSTRAINT "learned_patterns_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "todo_lists" ADD CONSTRAINT "todo_lists_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "todos" ADD CONSTRAINT "todos_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "care_rules" ADD CONSTRAINT "care_rules_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------- Schalter je Haushalt -------------------------
--
-- Der Schlüssel trug den Haushalt bisher als Präfix im Text ("1:care.blocks"),
-- weil es keine Spalte dafür gab. Jetzt gibt es eine — und zwei Wege, dasselbe
-- zu sagen, sind einer zu viel. Der Präfix fällt weg, der Primärschlüssel wird
-- zusammengesetzt.

UPDATE "app_settings" SET "key" = split_part("key", ':', 2)
  WHERE "key" LIKE '%:%';

ALTER TABLE "app_settings" DROP CONSTRAINT "app_settings_pkey";
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_pkey"
  PRIMARY KEY ("household_id", "key");
