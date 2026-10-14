-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Song" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "artist" TEXT,
    "genre" TEXT,
    "defaultKey" TEXT,
    "alternateKeys" JSONB NOT NULL,
    "notes" TEXT,
    "meta" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Song_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChordChart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "title" TEXT,
    "format" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "timeSignature" TEXT NOT NULL,
    "tempo" INTEGER,
    "capo" INTEGER,
    "sections" JSONB NOT NULL,
    "source" TEXT,
    "origin" JSONB,
    "originUrl" TEXT,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChordChart_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChordChart_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Song_organizationId_idx" ON "Song"("organizationId");

-- CreateIndex
CREATE INDEX "ChordChart_organizationId_songId_idx" ON "ChordChart"("organizationId", "songId");

-- CreateIndex
CREATE UNIQUE INDEX "ChordChart_organizationId_originUrl_key" ON "ChordChart"("organizationId", "originUrl");
