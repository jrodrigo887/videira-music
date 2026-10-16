-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN "currentPeriodEnd" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Song" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "createdByUserId" TEXT;

-- AlterTable
ALTER TABLE "ChordChart" ADD COLUMN "createdByUserId" TEXT,
ADD COLUMN "lastEditedByUserId" TEXT;

-- AlterTable
ALTER TABLE "Setlist" ADD COLUMN "createdByUserId" TEXT;

-- CreateTable
CREATE TABLE "ChordChartRevision" (
    "id" TEXT NOT NULL,
    "chartId" TEXT NOT NULL,
    "source" TEXT,
    "sections" JSONB NOT NULL,
    "key" TEXT NOT NULL,
    "capo" INTEGER,
    "savedByUserId" TEXT,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChordChartRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartSuggestion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "chartId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "key" TEXT NOT NULL,
    "capo" INTEGER,
    "status" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChartSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetlistShareLink" (
    "id" TEXT NOT NULL,
    "setlistId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetlistShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapabilityDelegation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "grantorUserId" TEXT NOT NULL,
    "granteeUserId" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL,
    "teamIds" JSONB NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapabilityDelegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewAsSession" (
    "id" TEXT NOT NULL,
    "viewerUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViewAsSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "Organization"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Song_organizationId_deletedAt_idx" ON "Song"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "ChordChartRevision_chartId_savedAt_idx" ON "ChordChartRevision"("chartId", "savedAt");

-- CreateIndex
CREATE INDEX "ChartSuggestion_chartId_status_idx" ON "ChartSuggestion"("chartId", "status");

-- CreateIndex
CREATE INDEX "ChartSuggestion_chartId_authorUserId_idx" ON "ChartSuggestion"("chartId", "authorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SetlistShareLink_tokenHash_key" ON "SetlistShareLink"("tokenHash");

-- CreateIndex
CREATE INDEX "SetlistShareLink_setlistId_idx" ON "SetlistShareLink"("setlistId");

-- CreateIndex
CREATE INDEX "CapabilityDelegation_granteeUserId_expiresAt_idx" ON "CapabilityDelegation"("granteeUserId", "expiresAt");

-- CreateIndex
CREATE INDEX "ViewAsSession_viewerUserId_endedAt_idx" ON "ViewAsSession"("viewerUserId", "endedAt");

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChordChart" ADD CONSTRAINT "ChordChart_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChordChart" ADD CONSTRAINT "ChordChart_lastEditedByUserId_fkey" FOREIGN KEY ("lastEditedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setlist" ADD CONSTRAINT "Setlist_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChordChartRevision" ADD CONSTRAINT "ChordChartRevision_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "ChordChart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChordChartRevision" ADD CONSTRAINT "ChordChartRevision_savedByUserId_fkey" FOREIGN KEY ("savedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartSuggestion" ADD CONSTRAINT "ChartSuggestion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartSuggestion" ADD CONSTRAINT "ChartSuggestion_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "ChordChart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartSuggestion" ADD CONSTRAINT "ChartSuggestion_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartSuggestion" ADD CONSTRAINT "ChartSuggestion_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetlistShareLink" ADD CONSTRAINT "SetlistShareLink_setlistId_fkey" FOREIGN KEY ("setlistId") REFERENCES "Setlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetlistShareLink" ADD CONSTRAINT "SetlistShareLink_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapabilityDelegation" ADD CONSTRAINT "CapabilityDelegation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapabilityDelegation" ADD CONSTRAINT "CapabilityDelegation_grantorUserId_fkey" FOREIGN KEY ("grantorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapabilityDelegation" ADD CONSTRAINT "CapabilityDelegation_granteeUserId_fkey" FOREIGN KEY ("granteeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewAsSession" ADD CONSTRAINT "ViewAsSession_viewerUserId_fkey" FOREIGN KEY ("viewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewAsSession" ADD CONSTRAINT "ViewAsSession_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
