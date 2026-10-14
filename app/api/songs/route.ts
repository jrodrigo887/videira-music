import {
  persistenceError,
  wrapPersistenceRoute,
} from "@/lib/persistence/persistence-api";
import {
  createPersistenceRouteDependencies,
  type PersistenceRouteDependencies,
  withRepository,
} from "@/lib/persistence/persistence-route-deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SongsRouteDependencies = PersistenceRouteDependencies;

export function createSongsGetHandler(dependencies: SongsRouteDependencies) {
  return async function get(): Promise<Response> {
    const result = await withRepository(dependencies, async (repository) => {
      const songs = await repository.listSongs();
      return Response.json({ songs });
    });
    return result instanceof Response ? result : Response.json({ songs: [] });
  };
}

export const GET = wrapPersistenceRoute(
  { route: "/api/songs", method: "GET" },
  createSongsGetHandler(createPersistenceRouteDependencies()),
);
