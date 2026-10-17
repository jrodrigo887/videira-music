import { forbiddenResponse } from "@/lib/auth/api-guard";
import { hasCapability } from "@/lib/auth/actor";
import { getCurrentActor } from "@/lib/auth/current-actor";
import type { UserActor } from "@/lib/auth/actor";
import {
  isChartHistoryServiceError,
  saveChartWithHistory,
} from "@/lib/charts/chart-history-service";
import {
  chartOriginGateKind,
  gateChartWriteWithOrigin,
  persistenceError,
  readJsonBody,
  recordFailedChartSave,
  recordSuccessfulChartSave,
  wrapPersistenceRoute,
} from "@/lib/persistence/persistence-api";
import { getPrisma } from "@/lib/persistence/prisma-client";
import {
  createPersistenceRouteDependencies,
  type PersistenceRouteDependencies,
  withRepository,
} from "@/lib/persistence/persistence-route-deps";
import {
  parseChartJson,
  WRITE_BODY_LIMIT_BYTES,
} from "@/lib/persistence/validate-persistence-input";
import { isEditableChartKey } from "@/lib/charts/chart-edit-options";
import { canEditChartContent } from "@/lib/songs/song-policy";
import type { ChordChart } from "@/types/music";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type ChartPutDependencies = PersistenceRouteDependencies & {
  getActor?: typeof getCurrentActor;
  persistChart?: (actor: UserActor, chart: ChordChart) => Promise<void>;
  canEditChart?: (
    actor: UserActor,
    input: { chartId: string; songId: string; existingCreatedByUserId: string | null },
  ) => Promise<boolean>;
  preflightChartWrite?: (actor: UserActor, chartId: string) => Promise<Response | undefined>;
};

async function defaultPersistChart(actor: UserActor, chart: ChordChart): Promise<void> {
  const prisma = getPrisma();
  await saveChartWithHistory(prisma, actor, chart);
}

async function defaultPreflightChartWrite(
  actor: UserActor,
  chartId: string,
  canEditChart: ChartPutDependencies["canEditChart"],
): Promise<Response | undefined> {
  const existingRow = await getPrisma().chordChart.findFirst({
    where: { id: chartId, organizationId: actor.organizationId },
    select: { createdByUserId: true, songId: true },
  });
  if (existingRow) {
    const songRow = await getPrisma().song.findFirst({
      where: { id: existingRow.songId, organizationId: actor.organizationId },
      select: { deletedAt: true },
    });
    const allowed = await (canEditChart ?? defaultCanEditChart)(actor, {
      chartId,
      songId: existingRow.songId,
      existingCreatedByUserId: existingRow.createdByUserId,
    });
    if (!allowed || !songRow || songRow.deletedAt) {
      return forbiddenResponse();
    }
    return undefined;
  }
  if (!hasCapability(actor, "music:write", actor.organizationId)) {
    return forbiddenResponse();
  }
  return undefined;
}

async function defaultCanEditChart(
  actor: UserActor,
  input: { chartId: string; songId: string; existingCreatedByUserId: string | null },
): Promise<boolean> {
  const prisma = getPrisma();
  const songRow = await prisma.song.findFirst({
    where: { id: input.songId, organizationId: actor.organizationId },
    select: { deletedAt: true },
  });
  if (!songRow || songRow.deletedAt) {
    return false;
  }
  return canEditChartContent(
    actor,
    { organizationId: actor.organizationId, createdByUserId: input.existingCreatedByUserId },
    { deletedAt: songRow.deletedAt },
  );
}

export function createChartPutHandler(dependencies: ChartPutDependencies) {
  const getActor = dependencies.getActor ?? getCurrentActor;
  const persistChart = dependencies.persistChart ?? defaultPersistChart;
  const canEditChart = dependencies.canEditChart ?? defaultCanEditChart;
  const preflightChartWrite =
    dependencies.preflightChartWrite ??
    ((actor, chartId) => defaultPreflightChartWrite(actor, chartId, canEditChart));

  return async function put(request: Request, context?: unknown): Promise<Response> {
    const actorResult = await getActor();
    if (actorResult.kind !== "user") {
      return persistenceError(401, "UNAUTHENTICATED", "Não autenticado.");
    }
    const actor = actorResult;

    const { chartId } = await (context as { params: Promise<{ chartId: string }> }).params;

    if (dependencies.isConfigured()) {
      const preflight = await preflightChartWrite(actor, chartId);
      if (preflight) {
        return preflight;
      }
    }

    let body: unknown;
    try {
      body = await readJsonBody(request, WRITE_BODY_LIMIT_BYTES);
    } catch (error) {
      if (error instanceof Error && error.name === "PayloadTooLargeError") {
        return persistenceError(413, "PAYLOAD_TOO_LARGE", "Corpo da requisição grande demais.");
      }
      return persistenceError(400, "INVALID_REQUEST", "JSON inválido.");
    }

    const parsed = parseChartJson(body);
    if (!parsed.ok) {
      return persistenceError(422, "VALIDATION_FAILED", "Dados inválidos.", {
        issues: parsed.issues,
      });
    }
    if (parsed.value.id !== chartId) {
      return persistenceError(422, "VALIDATION_FAILED", "Dados inválidos.", {
        issues: [{ path: "id", message: "ID do corpo difere do caminho." }],
      });
    }

    if (!isEditableChartKey(parsed.value.key)) {
      return persistenceError(422, "VALIDATION_FAILED", "Dados inválidos.", {
        issues: [{ path: "key", message: "Tom inválido." }],
      });
    }

    let importGate = false;

    const result = await withRepository(dependencies, async (repository) => {
      const existing = await repository.findChartById(chartId);
      if (existing && parsed.value.songId !== existing.songId) {
        return persistenceError(422, "VALIDATION_FAILED", "Dados inválidos.", {
          issues: [{ path: "songId", message: "Música da cifra não pode ser alterada." }],
        });
      }

      const gateKind = chartOriginGateKind(existing, body);
      importGate = gateKind === "import";
      if (gateKind === "import") {
        const gateResponse = await gateChartWriteWithOrigin(request, body);
        if (gateResponse) {
          return gateResponse;
        }
      }

      try {
        await persistChart(actor, parsed.value);
      } catch (error) {
        if (isChartHistoryServiceError(error)) {
          return persistenceError(error.status, error.code, error.code);
        }
        throw error;
      }

      if (gateKind === "import") {
        await recordSuccessfulChartSave(body, parsed.value.id);
      }
      return new Response(null, { status: 204 });
    });

    if (result instanceof Response && result.status >= 400 && importGate) {
      await recordFailedChartSave(body, "PERSISTENCE_FAILED");
    }
    return result instanceof Response ? result : persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  };
}

export const PUT = wrapPersistenceRoute(
  { route: "/api/charts/[chartId]", method: "PUT", permission: "music:read" },
  createChartPutHandler(createPersistenceRouteDependencies()),
);
