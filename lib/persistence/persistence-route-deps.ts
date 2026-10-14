import "server-only";

import type { MusicRepository } from "./music-repository";
import {
  DatabaseNotConfiguredError,
  DatabaseUnavailableError,
  ensureSqlitePragmas,
  getPrisma,
  isDatabaseBusyError,
  isDatabaseConfigured,
} from "./prisma-client";
import { getDefaultOrganizationId } from "./organization-scope";
import { PrismaMusicRepository } from "./prisma-music-repository";
import { OriginUrlConflictError, SongNotFoundError } from "./repository-error";
import { persistenceError } from "./persistence-api";

export type PersistenceRouteDependencies = {
  isConfigured(): boolean;
  getRepository(): Promise<MusicRepository>;
};

export function createPersistenceRouteDependencies(): PersistenceRouteDependencies {
  return {
    isConfigured: () => isDatabaseConfigured(),
    getRepository: async () => {
      const prisma = getPrisma();
      await ensureSqlitePragmas(prisma);
      const organizationId = await getDefaultOrganizationId(prisma);
      return new PrismaMusicRepository(prisma, { organizationId });
    },
  };
}

export async function mapPersistenceFailure(error: unknown): Promise<Response> {
  if (error instanceof DatabaseNotConfiguredError) {
    return persistenceError(503, "DATABASE_NOT_CONFIGURED", "Banco de dados não configurado.");
  }
  if (error instanceof DatabaseUnavailableError || isDatabaseBusyError(error)) {
    return persistenceError(503, "DATABASE_UNAVAILABLE", "Banco de dados indisponível.", {
      headers: { "Retry-After": "2" },
    });
  }
  if (error instanceof SongNotFoundError) {
    return persistenceError(404, "SONG_NOT_FOUND", "Música não encontrada.");
  }
  if (error instanceof OriginUrlConflictError) {
    return persistenceError(409, "ORIGIN_URL_CONFLICT", "Já existe uma cifra com esta URL.", {
      existingChartId: error.existingChartId,
    });
  }
  return persistenceError(500, "PERSISTENCE_FAILED", "Não foi possível concluir a operação.");
}

export async function withRepository<T>(
  dependencies: PersistenceRouteDependencies,
  run: (repository: MusicRepository) => Promise<T>,
): Promise<T | Response> {
  if (!dependencies.isConfigured()) {
    return persistenceError(503, "DATABASE_NOT_CONFIGURED", "Banco de dados não configurado.");
  }
  try {
    const repository = await dependencies.getRepository();
    return await run(repository);
  } catch (error) {
    return mapPersistenceFailure(error);
  }
}
