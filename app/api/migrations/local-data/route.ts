import { persistenceError, readJsonBody, wrapPersistenceRoute } from "@/lib/persistence/persistence-api";
import {
  createPersistenceRouteDependencies,
  type PersistenceRouteDependencies,
  withRepository,
} from "@/lib/persistence/persistence-route-deps";
import { migrateLocalDataBatch } from "@/lib/persistence/migrate-local-data-batch";
import {
  MIGRATION_BODY_LIMIT_BYTES,
  parseMigrationBatch,
} from "@/lib/persistence/validate-persistence-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function createLocalDataMigrationPostHandler(dependencies: PersistenceRouteDependencies) {
  return async function post(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await readJsonBody(request, MIGRATION_BODY_LIMIT_BYTES);
    } catch (error) {
      if (error instanceof Error && error.name === "PayloadTooLargeError") {
        return persistenceError(413, "PAYLOAD_TOO_LARGE", "Lote grande demais.");
      }
      return persistenceError(400, "INVALID_REQUEST", "JSON inválido.");
    }

    const parsed = parseMigrationBatch(body);
    if (!parsed.ok) {
      return persistenceError(422, "VALIDATION_FAILED", "Lote inválido.", {
        issues: parsed.issues,
      });
    }

    const result = await withRepository(dependencies, async () => {
      const summary = await migrateLocalDataBatch(parsed.value);
      console.error(
        JSON.stringify({
          route: "/api/migrations/local-data",
          method: "POST",
          migration: {
            songsCreated: summary.songsCreated,
            songsSkipped: summary.songsSkipped,
            chartsCreated: summary.chartsCreated,
            chartsSkipped: summary.chartsSkipped,
            failureIds: summary.failures.map((failure) => failure.id),
          },
        }),
      );
      return Response.json(summary);
    });
    return result instanceof Response ? result : persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  };
}

export const POST = wrapPersistenceRoute(
  { route: "/api/migrations/local-data", method: "POST" },
  createLocalDataMigrationPostHandler(createPersistenceRouteDependencies()),
);
