import {
  assertImportWriteAllowed,
  persistenceError,
  readJsonBody,
  wrapPersistenceRoute,
} from "@/lib/persistence/persistence-api";
import {
  createPersistenceRouteDependencies,
  type PersistenceRouteDependencies,
  withRepository,
} from "@/lib/persistence/persistence-route-deps";
import {
  parseSongChartBody,
  WRITE_BODY_LIMIT_BYTES,
} from "@/lib/persistence/validate-persistence-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function createSongChartsPostHandler(dependencies: PersistenceRouteDependencies) {
  return async function post(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await readJsonBody(request, WRITE_BODY_LIMIT_BYTES);
    } catch (error) {
      if (error instanceof Error && error.name === "PayloadTooLargeError") {
        return persistenceError(413, "PAYLOAD_TOO_LARGE", "Corpo da requisição grande demais.");
      }
      return persistenceError(400, "INVALID_REQUEST", "JSON inválido.");
    }

    const parsed = parseSongChartBody(body);
    if (!parsed.ok) {
      return persistenceError(422, "VALIDATION_FAILED", "Dados inválidos.", {
        issues: parsed.issues,
      });
    }

    assertImportWriteAllowed(parsed.value.chart);

    const result = await withRepository(dependencies, async (repository) => {
      await repository.saveSongAndChart(parsed.value.song, parsed.value.chart);
      return new Response(null, { status: 204 });
    });
    return result instanceof Response ? result : persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  };
}

export const POST = wrapPersistenceRoute(
  { route: "/api/song-charts", method: "POST" },
  createSongChartsPostHandler(createPersistenceRouteDependencies()),
);
