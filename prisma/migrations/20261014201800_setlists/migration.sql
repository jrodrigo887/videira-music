-- AlterTable
ALTER TABLE "Song" ADD COLUMN "sourceOrganizationId" TEXT;

-- AlterTable
ALTER TABLE "ChordChart" ADD COLUMN "sourceOrganizationId" TEXT;

-- CreateTable
CREATE TABLE "Setlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "ownerTeamId" TEXT,
    "ownerUserId" TEXT,
    "title" TEXT NOT NULL,
    "eventType" TEXT,
    "eventAt" DATETIME,
    "status" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Setlist_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Setlist_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "WorshipTeam" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SetlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setlistId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "songId" TEXT,
    "chartId" TEXT,
    "selectedKey" TEXT,
    "text" TEXT,
    "notes" TEXT,
    CONSTRAINT "SetlistItem_setlistId_fkey" FOREIGN KEY ("setlistId") REFERENCES "Setlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SetlistItem_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SetlistItem_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "ChordChart" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SetlistFollow" (
    "setlistId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("setlistId", "teamId"),
    CONSTRAINT "SetlistFollow_setlistId_fkey" FOREIGN KEY ("setlistId") REFERENCES "Setlist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SetlistFollow_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "WorshipTeam" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Setlist_organizationId_ownerTeamId_idx" ON "Setlist"("organizationId", "ownerTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "SetlistItem_setlistId_position_key" ON "SetlistItem"("setlistId", "position");

-- CreateIndex
CREATE INDEX "SetlistItem_chartId_idx" ON "SetlistItem"("chartId");

-- CreateIndex
CREATE INDEX "SetlistFollow_teamId_idx" ON "SetlistFollow"("teamId");
