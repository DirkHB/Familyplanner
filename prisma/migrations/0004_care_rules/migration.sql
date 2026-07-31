-- CreateTable
CREATE TABLE "care_rules" (
    "id" TEXT NOT NULL,
    "title_key" TEXT NOT NULL,
    "decision" TEXT NOT NULL DEFAULT 'keine',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "care_rules_title_key_key" ON "care_rules"("title_key");
