import type { PrismaClient } from "@prisma/client";

import { loadActorForUser } from "@/lib/auth/load-actor";
import type { Actor } from "@/lib/auth/actor";
import { seedSimulatedIdentities } from "@/lib/auth/simulated-identities";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import type { ChordChart, Song } from "@/types/music";

export const FIXTURE_SONG: Song = {
  id: "song-fixture",
  title: "Fixture Song",
  label: "Fixture Song",
  alternateKeys: [],
  meta: "meta",
};

export const FIXTURE_CHART: ChordChart = {
  id: "chart-fixture",
  songId: FIXTURE_SONG.id,
  format: "lyrics",
  key: "G",
  timeSignature: "4/4",
  sections: [],
};

export async function seedSetlistFixture(prisma: PrismaClient): Promise<void> {
  await seedSimulatedIdentities(prisma);
  await prisma.song.upsert({
    where: { id: FIXTURE_SONG.id },
    create: {
      id: FIXTURE_SONG.id,
      organizationId: DEFAULT_ORGANIZATION_ID,
      title: FIXTURE_SONG.title,
      label: FIXTURE_SONG.label,
      alternateKeys: FIXTURE_SONG.alternateKeys,
      meta: FIXTURE_SONG.meta,
      searchText: "fixture song",
    },
    update: {},
  });
  await prisma.chordChart.upsert({
    where: { id: FIXTURE_CHART.id },
    create: {
      id: FIXTURE_CHART.id,
      organizationId: DEFAULT_ORGANIZATION_ID,
      songId: FIXTURE_CHART.songId,
      format: FIXTURE_CHART.format,
      key: FIXTURE_CHART.key,
      timeSignature: FIXTURE_CHART.timeSignature,
      sections: FIXTURE_CHART.sections,
    },
    update: {},
  });
}

export async function actorFor(prisma: PrismaClient, userId: string): Promise<Actor> {
  return loadActorForUser(prisma, userId);
}
