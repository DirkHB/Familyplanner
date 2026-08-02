-- Aufgabenlisten und Läden als Zeilen statt fest im Code.

-- CreateTable
CREATE TABLE "todo_lists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "todo_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "todos" ADD COLUMN "list_id" TEXT;
ALTER TABLE "todos" ADD COLUMN "source_uid" TEXT;
ALTER TABLE "shopping_items" ADD COLUMN "store_id" TEXT;

-- CreateIndex
CREATE INDEX "todos_list_id_idx" ON "todos"("list_id");
CREATE INDEX "todos_source_uid_idx" ON "todos"("source_uid");
CREATE INDEX "shopping_items_store_id_idx" ON "shopping_items"("store_id");

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_list_id_fkey"
  FOREIGN KEY ("list_id") REFERENCES "todo_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Die bisher fest verdrahteten Läden als Zeilen anlegen. „Sonstiges" bewusst
-- nicht: Das ist ab jetzt das Fach ohne Laden (store_id IS NULL) und muss
-- immer da sein, also darf es keine löschbare Zeile werden.
INSERT INTO "stores" ("id", "name", "sort_order", "createdAt") VALUES
  ('str_seed_lidl',   'Lidl',  0, CURRENT_TIMESTAMP),
  ('str_seed_ali',    'Ali',   1, CURRENT_TIMESTAMP),
  ('str_seed_edeka',  'Edeka', 2, CURRENT_TIMESTAMP),
  ('str_seed_kaefer', 'Käfer', 3, CURRENT_TIMESTAMP);

-- Bestehende Artikel mitnehmen. Alles andere — auch „sonstiges" und
-- Unbekanntes — bleibt store_id NULL und landet damit in „Sonstiges".
UPDATE "shopping_items" SET "store_id" = 'str_seed_lidl'   WHERE "category" = 'lidl';
UPDATE "shopping_items" SET "store_id" = 'str_seed_ali'    WHERE "category" = 'ali';
UPDATE "shopping_items" SET "store_id" = 'str_seed_edeka'  WHERE "category" = 'edeka';
UPDATE "shopping_items" SET "store_id" = 'str_seed_kaefer' WHERE "category" = 'kaefer';
