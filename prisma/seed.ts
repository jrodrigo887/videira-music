import { PrismaClient } from "@prisma/client";

import { seedSimulatedIdentities } from "../lib/auth/simulated-identities";
import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_ORGANIZATION_NAME,
  DEFAULT_ORGANIZATION_SLUG,
} from "../lib/persistence/organization-scope";

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  await prisma.organization.upsert({
    where: { slug: DEFAULT_ORGANIZATION_SLUG },
    create: {
      id: DEFAULT_ORGANIZATION_ID,
      slug: DEFAULT_ORGANIZATION_SLUG,
      name: DEFAULT_ORGANIZATION_NAME,
    },
    update: {},
  });

  if (process.env.NODE_ENV !== "production") {
    await seedSimulatedIdentities(prisma);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
