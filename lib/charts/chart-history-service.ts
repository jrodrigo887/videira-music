import type { PrismaClient } from "@prisma/client";

import type { UserActor } from "@/lib/auth/actor";
import { PrismaMusicRepository } from "@/lib/persistence/prisma-music-repository";
import { toDomainChart } from "@/lib/persistence/persistence-utils";
import { canEditChartContent } from "@/lib/songs/song-policy";
import type { ChordChart } from "@/types/music";

export class ChartHistoryServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "ChartHistoryServiceError";
    this.status = status;
    this.code = code;
  }
}

function historyError(status: number, code: string): ChartHistoryServiceError {
  return new ChartHistoryServiceError(status, code);
}

export function isChartHistoryServiceError(error: unknown): error is ChartHistoryServiceError {
  return error instanceof ChartHistoryServiceError;
}

export type ChartRevisionSummary = {
  id: string;
  savedAt: string;
};

async function loadChartContext(
  prisma: PrismaClient,
  organizationId: string,
  chartId: string,
): Promise<
  | {
      chart: ChordChart;
      createdByUserId: string | null;
      lastEditedByUserId: string | null;
      songDeletedAt: Date | null;
    }
  | undefined
> {
  const row = await prisma.chordChart.findFirst({
    where: { id: chartId, organizationId },
    include: { song: { select: { deletedAt: true } } },
  });
  if (!row) {
    return undefined;
  }
  return {
    chart: toDomainChart(row),
    createdByUserId: row.createdByUserId,
    lastEditedByUserId: row.lastEditedByUserId,
    songDeletedAt: row.song.deletedAt,
  };
}

function assertCanEdit(
  actor: UserActor,
  context: {
    organizationId: string;
    createdByUserId: string | null;
    songDeletedAt: Date | null;
  },
): void {
  if (
    !canEditChartContent(
      actor,
      { organizationId: context.organizationId, createdByUserId: context.createdByUserId },
      { deletedAt: context.songDeletedAt },
    )
  ) {
    throw historyError(403, "FORBIDDEN");
  }
}

export async function saveChartWithHistory(
  prisma: PrismaClient,
  actor: UserActor,
  chart: ChordChart,
): Promise<void> {
  const context = await loadChartContext(prisma, actor.organizationId, chart.id);
  if (context) {
    assertCanEdit(actor, {
      organizationId: actor.organizationId,
      createdByUserId: context.createdByUserId,
      songDeletedAt: context.songDeletedAt,
    });
  } else {
    const song = await prisma.song.findFirst({
      where: { id: chart.songId, organizationId: actor.organizationId, deletedAt: null },
    });
    if (!song) {
      throw historyError(404, "NOT_FOUND");
    }
  }

  await prisma.$transaction(async (tx) => {
    const repo = new PrismaMusicRepository(tx as PrismaClient, {
      organizationId: actor.organizationId,
    });
    const existing = await tx.chordChart.findFirst({
      where: { id: chart.id, organizationId: actor.organizationId },
    });

    if (existing) {
      await tx.chordChartRevision.create({
        data: {
          chartId: existing.id,
          source: existing.source,
          sections: existing.sections,
          key: existing.key,
          capo: existing.capo,
          savedByUserId: existing.lastEditedByUserId,
        },
      });
    }

    await repo.saveChart(chart);

    await tx.chordChart.update({
      where: { id: chart.id },
      data: {
        lastEditedByUserId: actor.userId,
        ...(existing ? {} : { createdByUserId: actor.userId }),
      },
    });
  });
}

export async function listRevisions(
  prisma: PrismaClient,
  actor: UserActor,
  chartId: string,
): Promise<ChartRevisionSummary[]> {
  const context = await loadChartContext(prisma, actor.organizationId, chartId);
  if (!context) {
    throw historyError(404, "NOT_FOUND");
  }
  assertCanEdit(actor, {
    organizationId: actor.organizationId,
    createdByUserId: context.createdByUserId,
    songDeletedAt: context.songDeletedAt,
  });

  const rows = await prisma.chordChartRevision.findMany({
    where: { chartId },
    orderBy: { savedAt: "desc" },
    select: { id: true, savedAt: true },
  });

  return rows.map((row) => ({
    id: row.id,
    savedAt: row.savedAt.toISOString(),
  }));
}

export async function restoreRevision(
  prisma: PrismaClient,
  actor: UserActor,
  chartId: string,
  revisionId: string,
): Promise<ChordChart> {
  const context = await loadChartContext(prisma, actor.organizationId, chartId);
  if (!context) {
    throw historyError(404, "NOT_FOUND");
  }
  assertCanEdit(actor, {
    organizationId: actor.organizationId,
    createdByUserId: context.createdByUserId,
    songDeletedAt: context.songDeletedAt,
  });

  const revision = await prisma.chordChartRevision.findFirst({
    where: { id: revisionId, chartId },
  });
  if (!revision) {
    throw historyError(404, "NOT_FOUND");
  }

  const restoredChart: ChordChart = {
    ...context.chart,
    source: revision.source ?? undefined,
    sections: revision.sections as ChordChart["sections"],
    key: revision.key,
    capo: revision.capo ?? undefined,
  };

  await saveChartWithHistory(prisma, actor, restoredChart);
  return restoredChart;
}
