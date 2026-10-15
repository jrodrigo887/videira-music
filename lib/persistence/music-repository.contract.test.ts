import { describe, expect, it, onTestFinished } from "vitest";

import type { ChordChart, Song } from "@/types/music";

import { HttpMusicRepository } from "./http-music-repository";
import { InMemoryMusicRepository, type MusicRepository } from "./music-repository";
import { PrismaMusicRepository } from "./prisma-music-repository";
import { createTestPrismaClient, createTempDatabaseUrl, destroyTestPrismaClient } from "./test-temp-db";

const SONG: Song = {
  id: "song-local-contract",
  title: "Canção contrato",
  label: "Canção contrato",
  defaultKey: "C",
  alternateKeys: ["D"],
  meta: "Meta",
  publicLyrics: false,
};

const CHART: ChordChart = {
  id: "chart-local-contract",
  songId: SONG.id,
  format: "lyrics",
  key: "C",
  timeSignature: "4/4",
  sections: [],
  origin: {
    kind: "url",
    url: "https://www.cifraclub.com.br/artista/cancao/#fragment",
    sourceName: "Cifra Club",
  },
};

function runContractSuite(name: string, createRepository: () => Promise<MusicRepository> | MusicRepository) {
  describe(name, () => {
    it("round-trips songs and charts and resolves canonical origin URLs", async () => {
      const repository = await createRepository();
      await repository.saveSongAndChart(SONG, CHART);

      await expect(repository.findSongById(SONG.id)).resolves.toEqual(SONG);
      await expect(repository.listChartsBySong(SONG.id)).resolves.toEqual([CHART]);
      await expect(
        repository.findChartByOriginUrl("https://www.cifraclub.com.br/artista/cancao/"),
      ).resolves.toEqual(CHART);
      await expect(repository.findSongById("missing")).resolves.toBeUndefined();
    });

    it("rolls back saveSongAndChart when chart write fails", async () => {
      const repository = await createRepository();
      const orphanChart: ChordChart = {
        ...CHART,
        id: "chart-orphan",
        songId: "missing-song",
      };

      await expect(repository.saveSongAndChart({ ...SONG, id: "song-rollback" }, orphanChart)).rejects.toThrow();
      await expect(repository.findSongById("song-rollback")).resolves.toBeUndefined();
    });
  });
}

runContractSuite("InMemoryMusicRepository", () => new InMemoryMusicRepository());

runContractSuite("PrismaMusicRepository", async () => {
  const temp = await createTempDatabaseUrl();
  const prisma = await createTestPrismaClient(temp.url);
  onTestFinished(async () => {
    await destroyTestPrismaClient(prisma);
    await temp.cleanup();
  });
  return new PrismaMusicRepository(prisma, { organizationId: "org-default" });
});

describe("HttpMusicRepository", () => {
  it("maps 404 lookups to undefined", async () => {
    const repository = new HttpMusicRepository({
      fetch: async (input, init) => {
        const url = String(input);
        if (url.includes("/api/songs/missing")) {
          return new Response(JSON.stringify({ error: { code: "SONG_NOT_FOUND", message: "x" } }), {
            status: 404,
          });
        }
        if (url.endsWith("/api/songs") && (!init || init.method === "GET")) {
          return Response.json({ songs: [] });
        }
        return new Response(null, { status: 204 });
      },
    });

    await expect(repository.findSongById("missing")).resolves.toBeUndefined();
  });
});
