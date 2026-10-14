import { persistenceError } from "@/lib/persistence/persistence-api";
import { mapPersistenceFailure } from "@/lib/persistence/persistence-route-deps";

import { SetlistError, type SetlistErrorExtras } from "./setlist-errors";
import { SetlistVersionConflictError } from "./setlist-repository";

const SETLIST_MESSAGES: Record<string, string> = {
  SETLIST_NOT_FOUND: "Setlist não encontrado.",
  FORBIDDEN: "Você não tem permissão para esta ação.",
  INVALID_REQUEST: "Requisição inválida.",
  INVALID_ITEM: "Item inválido.",
  INVALID_KEY: "Tom inválido.",
  INVALID_VISIBILITY: "Visibilidade inválida.",
  INVALID_STATUS_TRANSITION: "Transição de status inválida.",
  SETLIST_VERSION_CONFLICT: "Este setlist mudou. Recarregue para ver a versão atual.",
  SETLIST_HAS_FOLLOWERS: "Grupos seguem este setlist.",
  CANNOT_FOLLOW: "Não é possível seguir este setlist.",
  CANNOT_CLONE: "Não é possível clonar este setlist.",
  TEAM_ARCHIVED: "Grupo arquivado.",
  PERSISTENCE_FAILED: "Não foi possível concluir a operação.",
};

export function setlistError(
  status: number,
  code: string,
  message?: string,
  extras?: SetlistErrorExtras,
): Response {
  const body: Record<string, unknown> = {
    error: {
      code,
      message: message ?? SETLIST_MESSAGES[code] ?? code,
      ...(extras?.issues ? { issues: extras.issues } : {}),
      ...(extras?.version !== undefined ? { version: extras.version } : {}),
      ...(extras?.followerCount !== undefined ? { followerCount: extras.followerCount } : {}),
    },
  };
  return Response.json(body, { status });
}

export async function mapSetlistFailure(error: unknown): Promise<Response> {
  if (error instanceof SetlistError) {
    return setlistError(error.status, error.code, SETLIST_MESSAGES[error.code], error.extras);
  }
  if (error instanceof SetlistVersionConflictError) {
    return setlistError(409, "SETLIST_VERSION_CONFLICT", undefined, {
      version: error.currentVersion,
    });
  }
  return mapPersistenceFailure(error);
}

export async function withSetlistService<T>(
  run: () => Promise<T>,
): Promise<T | Response> {
  try {
    return await run();
  } catch (error) {
    return mapSetlistFailure(error);
  }
}
