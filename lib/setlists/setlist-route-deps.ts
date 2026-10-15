import "server-only";

import { getCurrentActor } from "@/lib/auth/current-actor";
import type { Actor } from "@/lib/auth/actor";
import { getPrisma, isDatabaseConfigured } from "@/lib/persistence/prisma-client";
import { getDefaultOrganizationId } from "@/lib/persistence/organization-scope";
import { PrismaWorshipTeamRepository } from "@/lib/worship-teams/prisma-worship-team-repository";
import {
  createWorshipTeamService,
  type WorshipTeamService,
} from "@/lib/worship-teams/worship-team-service";

import { createSetlistServiceFromPrisma, type SetlistService } from "./setlist-service";

export type SetlistRouteDependencies = {
  isConfigured(): boolean;
  getActor(): Promise<Actor>;
  getSetlistService(): Promise<SetlistService>;
  getTeamService(): Promise<WorshipTeamService>;
};

export function createSetlistRouteDependencies(): SetlistRouteDependencies {
  return {
    isConfigured: () => isDatabaseConfigured(),
    getActor: () => getCurrentActor(),
    getSetlistService: async () => {
      const prisma = getPrisma();
      const organizationId = await getDefaultOrganizationId(prisma);
      const teamRepository = new PrismaWorshipTeamRepository(prisma);
      return createSetlistServiceFromPrisma(prisma, organizationId, teamRepository);
    },
    getTeamService: async () => {
      const prisma = getPrisma();
      const organizationId = await getDefaultOrganizationId(prisma);
      return createWorshipTeamService({
        organizationId,
        repository: new PrismaWorshipTeamRepository(prisma),
        newId: () => crypto.randomUUID(),
      });
    },
  };
}

export function databaseNotConfiguredResponse(): Response {
  return Response.json(
    { error: { code: "DATABASE_NOT_CONFIGURED", message: "Banco de dados não configurado." } },
    { status: 503 },
  );
}
