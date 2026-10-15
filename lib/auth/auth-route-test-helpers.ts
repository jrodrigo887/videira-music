import type { PrismaClient } from "@prisma/client";

import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import { resetPrismaClientForTests } from "@/lib/persistence/prisma-client";
import {
  createTestPrismaClient,
  createTempDatabaseUrl,
  destroyTestPrismaClient,
} from "@/lib/persistence/test-temp-db";

import { seedSimulatedIdentities } from "./simulated-identities";

export type AuthApiTestContext = {
  prisma: PrismaClient;
  asUser: (userId: string) => void;
  cleanup: () => Promise<void>;
};

async function seedManagerUser(prisma: PrismaClient): Promise<void> {
  await prisma.user.upsert({
    where: { id: "user-manager" },
    create: {
      id: "user-manager",
      organizationId: DEFAULT_ORGANIZATION_ID,
      name: "Gestor",
      email: "gestor@videira.test",
      status: "active",
    },
    update: {},
  });
  await prisma.userRole.upsert({
    where: { userId_role: { userId: "user-manager", role: "manager" } },
    create: { userId: "user-manager", role: "manager" },
    update: {},
  });
}

export async function createAuthApiTestContext(
  initialUserId = "user-admin",
): Promise<AuthApiTestContext> {
  const temp = createTempDatabaseUrl();
  process.env.DATABASE_URL = temp.url;
  resetPrismaClientForTests();

  const prisma = await createTestPrismaClient(temp.url);
  await seedSimulatedIdentities(prisma);
  await seedManagerUser(prisma);

  const asUser = (userId: string) => {
    process.env.VIDEIRA_SIMULATED_USER_ID = userId;
  };
  asUser(initialUserId);

  return {
    prisma,
    asUser,
    cleanup: async () => {
      await destroyTestPrismaClient(prisma);
      temp.cleanup();
      resetPrismaClientForTests();
      delete process.env.VIDEIRA_SIMULATED_USER_ID;
    },
  };
}
