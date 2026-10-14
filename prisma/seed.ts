import { PrismaClient } from "@prisma/client";

import rawSongs from "../data/musicas.json";
import { toSong } from "../lib/data/songs";
import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_ORGANIZATION_NAME,
  DEFAULT_ORGANIZATION_SLUG,
} from "../lib/persistence/organization-scope";
import { toPrismaSongCreate } from "../lib/persistence/persistence-utils";

type SeedSong = {
  id: number;
  title: string;
  meta: string;
  label: string;
};

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

  const organizationId = DEFAULT_ORGANIZATION_ID;
  for (const seed of rawSongs as SeedSong[]) {
    const song = toSong(seed);
    const existing = await prisma.song.findUnique({ where: { id: song.id } });
    if (existing) {
      continue;
    }
    await prisma.song.create({
      data: toPrismaSongCreate(song, organizationId),
    });
  }
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
