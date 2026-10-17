import { forbiddenResponse, requireActor } from "@/lib/auth/api-guard";
import { getCurrentActor } from "@/lib/auth/current-actor";
import type { UserActor } from "@/lib/auth/actor";
import {
  deleteSong,
  isSongTrashServiceError,
} from "@/lib/songs/song-trash-service";
import {
  canChangePublicLyrics,
  canEditSongContent,
} from "@/lib/songs/song-policy";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";
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

type SongAuthRow = {
  createdByUserId: string | null;
  publicLyrics: boolean;
};

type SongRouteDependencies = PersistenceRouteDependencies & {
  getActor?: typeof getCurrentActor;
  findSongAuth?: (songId: string, organizationId: string) => Promise<SongAuthRow | null>;
  setCreatedByUserId?: (songId: string, userId: string) => Promise<void>;
};

async function defaultFindSongAuth(
  songId: string,
  organizationId: string,
): Promise<SongAuthRow | null> {
  const prisma = getPrisma();
  const row = await prisma.song.findFirst({
    where: { id: songId, organizationId, deletedAt: null },
    select: { createdByUserId: true, publicLyrics: true },
  });
  return row;
}

async function defaultSetCreatedByUserId(songId: string, userId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.song.update({
    where: { id: songId },
    data: { createdByUserId: userId },
  });
}

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
  const getActor = dependencies.getActor ?? getCurrentActor;
  const findSongAuth = dependencies.findSongAuth ?? defaultFindSongAuth;
  const setCreatedByUserId = dependencies.setCreatedByUserId ?? defaultSetCreatedByUserId;

  return async function put(request: Request, context?: unknown): Promise<Response> {
    const actorResult = await getActor();
    if (actorResult.kind !== "user") {
      return persistenceError(401, "UNAUTHENTICATED", "Não autenticado.");
    }
    const actor = actorResult;

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

    const existing = await findSongAuth(songId, actor.organizationId);

    const authorship = {
      organizationId: actor.organizationId,
      createdByUserId: existing?.createdByUserId ?? null,
      deletedAt: null,
    };

    if (!canEditSongContent(actor, authorship)) {
      return forbiddenResponse();
    }

    const nextPublicLyrics = parsed.value.publicLyrics ?? false;
    const publicLyricsChanging =
      existing !== null && nextPublicLyrics !== existing.publicLyrics;
    if (publicLyricsChanging && !canChangePublicLyrics(actor, authorship)) {
      return persistenceError(403, "PUBLIC_LYRICS_FORBIDDEN", "PUBLIC_LYRICS_FORBIDDEN");
    }

    const result = await withRepository(dependencies, async (repository) => {
      await repository.saveSong(parsed.value);
      if (!existing) {
        await setCreatedByUserId(songId, actor.userId);
      }
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
  { route: "/api/songs/[songId]", method: "PUT", permission: "music:read" },
  createSongPutHandler(dependencies),
);

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ songId: string }> },
): Promise<Response> {
  if (!isDatabaseConfigured()) {
    return persistenceError(503, "DATABASE_NOT_CONFIGURED", "Banco não configurado.");
  }
  const gate = await requireActor();
  if ("response" in gate) {
    return gate.response;
  }
  const { songId } = await context.params;
  const prisma = getPrisma();
  try {
    await deleteSong(prisma, gate.actor, songId);
    return Response.json({ ok: true });
  } catch (error) {
    if (isSongTrashServiceError(error)) {
      return persistenceError(error.status, error.code, error.code);
    }
    return persistenceError(500, "PERSISTENCE_FAILED", "Erro.");
  }
}
