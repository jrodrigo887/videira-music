import type { PrismaClient } from "@prisma/client";

import { loadActorForUser } from "@/lib/auth/load-actor";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import { resetPrismaClientForTests } from "@/lib/persistence/prisma-client";
import {
  createTestPrismaClient,
  createTempDatabaseUrl,
  destroyTestPrismaClient,
} from "@/lib/persistence/test-temp-db";
import { createSetlistRouteDependencies, type SetlistRouteDependencies } from "@/lib/setlists/setlist-route-deps";
import { createSetlistServiceFromPrisma } from "@/lib/setlists/setlist-service";
import { seedSetlistFixture } from "@/lib/setlists/setlist-test-fixture";
import { PrismaWorshipTeamRepository } from "@/lib/worship-teams/prisma-worship-team-repository";
import { createWorshipTeamService } from "@/lib/worship-teams/worship-team-service";

export type RouteTestContext = {
  prisma: PrismaClient;
  cleanup: () => Promise<void>;
  dependencies: SetlistRouteDependencies;
};

export async function createRouteTestContext(userId: string): Promise<RouteTestContext> {
  const temp = await createTempDatabaseUrl();
  process.env.DATABASE_URL = temp.url;
  process.env.VIDEIRA_SIMULATED_USER_ID = userId;
  resetPrismaClientForTests();

  const prisma = await createTestPrismaClient(temp.url);
  await seedSetlistFixture(prisma);

  const teamRepository = new PrismaWorshipTeamRepository(prisma);
  const dependencies: SetlistRouteDependencies = {
    isConfigured: () => true,
    getActor: () => loadActorForUser(prisma, userId),
    getSetlistService: async () =>
      createSetlistServiceFromPrisma(prisma, DEFAULT_ORGANIZATION_ID, teamRepository),
    getTeamService: async () =>
      createWorshipTeamService({
        organizationId: DEFAULT_ORGANIZATION_ID,
        repository: teamRepository,
        newId: () => crypto.randomUUID(),
      }),
  };

  return {
    prisma,
    dependencies,
    cleanup: async () => {
      await destroyTestPrismaClient(prisma);
      await temp.cleanup();
      resetPrismaClientForTests();
      delete process.env.VIDEIRA_SIMULATED_USER_ID;
    },
  };
}

export function createRealRouteDependencies(): SetlistRouteDependencies {
  return createSetlistRouteDependencies();
}

export function withSimulatedUser(
  context: RouteTestContext,
  userId: string,
): SetlistRouteDependencies {
  return {
    ...context.dependencies,
    getActor: () => loadActorForUser(context.prisma, userId),
  };
}
