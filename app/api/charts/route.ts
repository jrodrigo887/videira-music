import { persistenceError, wrapPersistenceRoute } from "@/lib/persistence/persistence-api";
import {
  createPersistenceRouteDependencies,
  type PersistenceRouteDependencies,
  withRepository,
} from "@/lib/persistence/persistence-route-deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function createChartsGetHandler(dependencies: PersistenceRouteDependencies) {
  return async function get(request: Request): Promise<Response> {
    const originUrl = new URL(request.url).searchParams.get("originUrl");
    if (!originUrl) {
      return persistenceError(400, "INVALID_REQUEST", "Informe originUrl.");
    }

    const result = await withRepository(dependencies, async (repository) => {
      const chart = await repository.findChartByOriginUrl(originUrl);
      if (!chart) {
        return persistenceError(404, "CHART_NOT_FOUND", "Cifra não encontrada.");
      }
      return Response.json({ chart });
    });
    return result instanceof Response ? result : persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  };
}

export const GET = wrapPersistenceRoute(
  { route: "/api/charts", method: "GET", permission: "music:read" },
  createChartsGetHandler(createPersistenceRouteDependencies()),
);
