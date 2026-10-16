import {
  chartOriginGateKind,
  gateChartWriteWithOrigin,
  persistenceError,
  readJsonBody,
  recordFailedChartSave,
  recordSuccessfulChartSave,
  wrapPersistenceRoute,
} from "@/lib/persistence/persistence-api";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function createChartPutHandler(dependencies: PersistenceRouteDependencies) {
  return async function put(request: Request, context?: unknown): Promise<Response> {
    const { chartId } = await (context as { params: Promise<{ chartId: string }> }).params;
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

      await repository.saveChart(parsed.value);
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
  { route: "/api/charts/[chartId]", method: "PUT", permission: "music:write" },
  createChartPutHandler(createPersistenceRouteDependencies()),
);
