import "server-only";

import { getDefaultOrganizationId } from "./organization-scope";
import { getPrisma } from "./prisma-client";
import { PrismaMusicRepository } from "./prisma-music-repository";
import type { ChordChart, Song } from "@/types/music";

export async function migrateLocalDataBatch(input: {
  songs: Song[];
  charts: ChordChart[];
}) {
  const prisma = getPrisma();
  const organizationId = await getDefaultOrganizationId(prisma);
  const repository = new PrismaMusicRepository(prisma, { organizationId });
  return repository.migrateBatch(input);
}
