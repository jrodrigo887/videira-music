import { wrapPersistenceRoute } from "@/lib/persistence/persistence-api";
import {
  createPersistenceRouteDependencies,
  type PersistenceRouteDependencies,
  withRepository,
} from "@/lib/persistence/persistence-route-deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function createSongChartsGetHandler(dependencies: PersistenceRouteDependencies) {
  return async function get(_request: Request, context?: unknown): Promise<Response> {
    const { songId } = await (context as { params: Promise<{ songId: string }> }).params;
    const result = await withRepository(dependencies, async (repository) => {
      const charts = await repository.listChartsBySong(songId);
      return Response.json({ charts });
    });
    return result instanceof Response ? result : Response.json({ charts: [] });
  };
}

export const GET = wrapPersistenceRoute(
  { route: "/api/songs/[songId]/charts", method: "GET", permission: "music:read" },
  createSongChartsGetHandler(createPersistenceRouteDependencies()),
);
