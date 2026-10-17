import type { PrismaClient } from "@prisma/client";

import type { UserActor } from "@/lib/auth/actor";
import { hasCapability } from "@/lib/auth/actor";
import { saveChartWithHistory } from "@/lib/charts/chart-history-service";
import { validateChartSourceText } from "@/lib/charts/chart-source-limits";
import { isEditableChartKey } from "@/lib/charts/chart-edit-options";
import { previewImport } from "@/lib/import/preview-import";
import { toDomainChart } from "@/lib/persistence/persistence-utils";
import type { ChordChart, Section } from "@/types/music";

export class ChartSuggestionServiceError extends Error {
  readonly status: number;
  readonly code: string;
  readonly userMessage: string;

  constructor(status: number, code: string, userMessage: string = code) {
    super(code);
    this.name = "ChartSuggestionServiceError";
    this.status = status;
    this.code = code;
    this.userMessage = userMessage;
  }
}

function suggestionError(
  status: number,
  code: string,
  userMessage?: string,
): ChartSuggestionServiceError {
  return new ChartSuggestionServiceError(status, code, userMessage ?? code);
}

export function isChartSuggestionServiceError(
  error: unknown,
): error is ChartSuggestionServiceError {
  return error instanceof ChartSuggestionServiceError;
}

export type SubmitSuggestionInput = {
  source: string;
  key?: string;
  capo?: number | null;
};

export type PendingSuggestion = {
  id: string;
  authorUserId: string;
  authorName: string | null;
  source: string;
  key: string;
  capo: number | null;
  createdAt: string;
};

async function loadWritableChart(
  prisma: PrismaClient,
  organizationId: string,
  chartId: string,
): Promise<ChordChart> {
  const row = await prisma.chordChart.findFirst({
    where: { id: chartId, organizationId },
    include: { song: { select: { deletedAt: true } } },
  });
  if (!row || row.song.deletedAt) {
    throw suggestionError(404, "NOT_FOUND");
  }
  return toDomainChart(row);
}

function assertCanReview(actor: UserActor): void {
  if (!hasCapability(actor, "music:write", actor.organizationId)) {
    throw suggestionError(403, "FORBIDDEN");
  }
}

function buildSectionsFromSource(chart: ChordChart, source: string): Section[] {
  const draft = previewImport({ text: source, origin: chart.origin });
  return draft.chart.sections;
}

export async function submitSuggestion(
  prisma: PrismaClient,
  actor: UserActor,
  chartId: string,
  input: SubmitSuggestionInput,
): Promise<{ status: "created" | "replaced" }> {
  const chart = await loadWritableChart(prisma, actor.organizationId, chartId);

  const validated = validateChartSourceText(input.source);
  if (!validated.ok) {
    throw suggestionError(400, "INVALID_REQUEST", validated.message);
  }

  const key = input.key?.trim() || chart.key;
  if (!isEditableChartKey(key)) {
    throw suggestionError(400, "INVALID_REQUEST", "Tom inválido.");
  }

  const capo =
    input.capo === null || input.capo === undefined
      ? chart.capo ?? null
      : input.capo > 0
        ? input.capo
        : null;

  const sections = buildSectionsFromSource(chart, input.source);

  const existing = await prisma.chartSuggestion.findFirst({
    where: {
      chartId,
      authorUserId: actor.userId,
      status: "pending",
    },
  });

  if (existing) {
    await prisma.chartSuggestion.update({
      where: { id: existing.id },
      data: {
        source: input.source,
        sections,
        key,
        capo,
      },
    });
    return { status: "replaced" };
  }

  await prisma.chartSuggestion.create({
    data: {
      organizationId: actor.organizationId,
      chartId,
      authorUserId: actor.userId,
      source: input.source,
      sections,
      key,
      capo,
      status: "pending",
    },
  });
  return { status: "created" };
}

export async function listPendingSuggestions(
  prisma: PrismaClient,
  actor: UserActor,
  chartId: string,
): Promise<PendingSuggestion[]> {
  assertCanReview(actor);
  await loadWritableChart(prisma, actor.organizationId, chartId);

  const rows = await prisma.chartSuggestion.findMany({
    where: { chartId, status: "pending" },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { name: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    authorUserId: row.authorUserId,
    authorName: row.author.name,
    source: row.source,
    key: row.key,
    capo: row.capo,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function approveSuggestion(
  prisma: PrismaClient,
  actor: UserActor,
  suggestionId: string,
): Promise<void> {
  assertCanReview(actor);

  const suggestion = await prisma.chartSuggestion.findFirst({
    where: { id: suggestionId, organizationId: actor.organizationId },
  });
  if (!suggestion) {
    throw suggestionError(404, "NOT_FOUND");
  }
  if (suggestion.status !== "pending") {
    throw suggestionError(409, "SUGGESTION_NOT_PENDING");
  }

  const chart = await loadWritableChart(prisma, actor.organizationId, suggestion.chartId);
  const sections = suggestion.sections as Section[];
  const updated: ChordChart = {
    ...chart,
    source: suggestion.source,
    sections: Array.isArray(sections) ? sections : chart.sections,
    key: suggestion.key,
    ...(suggestion.capo != null && suggestion.capo > 0 ? { capo: suggestion.capo } : {}),
  };

  await saveChartWithHistory(prisma, actor, updated);
  await prisma.chartSuggestion.update({
    where: { id: suggestionId },
    data: {
      status: "approved",
      reviewedByUserId: actor.userId,
      reviewedAt: new Date(),
    },
  });
}

export async function rejectSuggestion(
  prisma: PrismaClient,
  actor: UserActor,
  suggestionId: string,
): Promise<void> {
  assertCanReview(actor);

  const suggestion = await prisma.chartSuggestion.findFirst({
    where: { id: suggestionId, organizationId: actor.organizationId },
  });
  if (!suggestion) {
    throw suggestionError(404, "NOT_FOUND");
  }
  if (suggestion.status !== "pending") {
    throw suggestionError(409, "SUGGESTION_NOT_PENDING");
  }

  await prisma.chartSuggestion.update({
    where: { id: suggestionId },
    data: {
      status: "rejected",
      reviewedByUserId: actor.userId,
      reviewedAt: new Date(),
    },
  });
}
