import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import {
  createTempDatabaseUrl,
  createTestPrismaClient,
  destroyTestPrismaClient,
} from "@/lib/persistence/test-temp-db";

import { PrismaMusicRepository } from "./prisma-music-repository";

describe("PrismaMusicRepository trash filtering", () => {
  let temp!: { url: string; cleanup: () => Promise<void> };
  let prisma: PrismaClient;
  let repository: PrismaMusicRepository;

  beforeAll(async () => {
    temp = await createTempDatabaseUrl();
    prisma = await createTestPrismaClient(temp.url);
    repository = new PrismaMusicRepository(prisma, { organizationId: DEFAULT_ORGANIZATION_ID });
    await prisma.song.create({
      data: {
        id: "song-visible",
        organizationId: DEFAULT_ORGANIZATION_ID,
        title: "Visível",
        label: "Visível",
        alternateKeys: [],
        meta: "",
        searchText: "visivel",
        publicLyrics: false,
      },
    });
    await prisma.song.create({
      data: {
        id: "song-trashed",
        organizationId: DEFAULT_ORGANIZATION_ID,
        title: "Na lixeira",
        label: "Na lixeira",
        alternateKeys: [],
        meta: "",
        searchText: "lixeira",
        publicLyrics: false,
        deletedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await destroyTestPrismaClient(prisma);
    await temp.cleanup();
  });

  it("omits trashed songs from listSongs and findSongById", async () => {
    const songs = await repository.listSongs();
    expect(songs.map((song) => song.id)).toEqual(["song-visible"]);
    expect(await repository.findSongById("song-trashed")).toBeUndefined();
  });

  it("still finds trashed rows directly for restore flows", async () => {
    const row = await prisma.song.findFirst({
      where: { id: "song-trashed", organizationId: DEFAULT_ORGANIZATION_ID },
    });
    expect(row?.deletedAt).not.toBeNull();
  });
});
