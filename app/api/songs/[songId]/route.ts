import {
  PayloadTooLargeError,
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
  parseSongJson,
  WRITE_BODY_LIMIT_BYTES,
} from "@/lib/persistence/validate-persistence-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SongRouteDependencies = PersistenceRouteDependencies;

export function createSongGetHandler(dependencies: SongRouteDependencies) {
  return async function get(_request: Request, context?: unknown): Promise<Response> {
    const { songId } = await (context as { params: Promise<{ songId: string }> }).params;
    const result = await withRepository(dependencies, async (repository) => {
      const song = await repository.findSongById(songId);
      if (!song) {
        return persistenceError(404, "SONG_NOT_FOUND", "Música não encontrada.");
      }
      return Response.json({ song });
    });
    return result instanceof Response ? result : persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  };
}

export function createSongPutHandler(dependencies: SongRouteDependencies) {
  return async function put(request: Request, context?: unknown): Promise<Response> {
    const { songId } = await (context as { params: Promise<{ songId: string }> }).params;
    let body: unknown;
    try {
      body = await readJsonBody(request, WRITE_BODY_LIMIT_BYTES);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return persistenceError(413, "PAYLOAD_TOO_LARGE", "Corpo da requisição grande demais.");
      }
      return persistenceError(400, "INVALID_REQUEST", "JSON inválido.");
    }

    const parsed = parseSongJson(body);
    if (!parsed.ok) {
      return persistenceError(422, "VALIDATION_FAILED", "Dados inválidos.", {
        issues: parsed.issues,
      });
    }
    if (parsed.value.id !== songId) {
      return persistenceError(422, "VALIDATION_FAILED", "Dados inválidos.", {
        issues: [{ path: "id", message: "ID do corpo difere do caminho." }],
      });
    }

    const result = await withRepository(dependencies, async (repository) => {
      await repository.saveSong(parsed.value);
      return new Response(null, { status: 204 });
    });
    return result instanceof Response ? result : persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  };
}

const dependencies = createPersistenceRouteDependencies();

export const GET = wrapPersistenceRoute(
  { route: "/api/songs/[songId]", method: "GET", permission: "music:read" },
  createSongGetHandler(dependencies),
);

export const PUT = wrapPersistenceRoute(
  { route: "/api/songs/[songId]", method: "PUT", permission: "music:write" },
  createSongPutHandler(dependencies),
);
