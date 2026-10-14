-- CreateTable
CREATE TABLE "ImportLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "occurredAt" DATETIME NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "url" TEXT,
    "chartId" TEXT
);

-- CreateIndex
CREATE INDEX "ImportLog_occurredAt_idx" ON "ImportLog"("occurredAt");
