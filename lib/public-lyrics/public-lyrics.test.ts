import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaMusicRepository } from "@/lib/persistence/prisma-music-repository";
import {
  createTempDatabaseUrl,
  createTestPrismaClient,
  destroyTestPrismaClient,
} from "@/lib/persistence/test-temp-db";
import type { ChordChart, Song } from "@/types/music";

import { getPublicLyrics, listPublicSongs, toPublicLyrics } from "./public-lyrics";

function baseSong(id: string, title: string, publicLyrics: boolean): Song {
  return {
    id,
    title,
    label: title,
    alternateKeys: [],
    meta: "",
    publicLyrics,
  };
}

const SECTIONS_WITH_CHORDS = [
  {
    id: "verse-1",
    type: "verse" as const,
    label: "Verso",
    content: {
      lines: [
        {
          text: "Minha oração só é real",
          chords: [
            { symbol: "Am7", position: 0 },
            { symbol: "G", position: 18 },
          ],
        },
        { text: "   ", chords: [] },
        { text: "Se começar em mim", chords: [{ symbol: "C9", position: 0 }] },
      ],
    },
  },
];

describe("toPublicLyrics (AUTH-37)", () => {
  it("returns only title, artist, section labels and lyric text", () => {
    const publicLyrics = toPublicLyrics({
      title: "Canção pública",
      artist: "Artista",
      originUrl: null,
      origin: null,
      sections: SECTIONS_WITH_CHORDS,
    });

    expect(publicLyrics).toEqual({
      title: "Canção pública",
      artist: "Artista",
      imported: null,
      sections: [
        {
          label: "Verso",
          lines: ["Minha oração só é real", "Se começar em mim"],
        },
      ],
    });

    const serialized = JSON.stringify(publicLyrics);
    expect(serialized).not.toMatch(/Am7|"key"|capo|tempo|timeSignature|chart-/i);
    expect(serialized).not.toContain("chords");
  });

  it("exposes imported metadata when origin is present (AUTH-39)", () => {
    const publicLyrics = toPublicLyrics({
      title: "Importada",
      artist: null,
      originUrl: "https://www.cifraclub.com.br/artista/cancao/",
      origin: { kind: "url", url: "https://www.cifraclub.com.br/artista/cancao/" },
      sections: [],
    });

    expect(publicLyrics.imported).toEqual({
      originUrl: "https://www.cifraclub.com.br/artista/cancao/",
    });
  });
});

describe("public lyrics queries", () => {
  let temp!: { url: string; cleanup: () => Promise<void> };
  let prisma: PrismaClient;
  let repository: PrismaMusicRepository;

  beforeAll(async () => {
    temp = await createTempDatabaseUrl();
    prisma = await createTestPrismaClient(temp.url);
    repository = new PrismaMusicRepository(prisma, { organizationId: "org-default" });
  });

  afterAll(async () => {
    await destroyTestPrismaClient(prisma);
    await temp.cleanup();
  });

  async function seedSong(
    song: Song,
    charts: ChordChart[],
  ): Promise<void> {
    await repository.saveSong(song);
    for (const chart of charts) {
      await repository.saveChart(chart);
    }
  }

  it("lists only public songs with a lyrics chart (AUTH-35)", async () => {
    await seedSong(
      baseSong("song-public-list", "Alpha Pública", true),
      [
        {
          id: "chart-public-list",
          songId: "song-public-list",
          format: "lyrics",
          key: "G",
          timeSignature: "4/4",
          sections: SECTIONS_WITH_CHORDS,
        },
      ],
    );
    await seedSong(
      baseSong("song-private-list", "Beta Privada", false),
      [
        {
          id: "chart-private-list",
          songId: "song-private-list",
          format: "lyrics",
          key: "C",
          timeSignature: "4/4",
          sections: SECTIONS_WITH_CHORDS,
        },
      ],
    );
    await seedSong(
      baseSong("song-public-no-lyrics", "Gamma sem letra", true),
      [
        {
          id: "chart-grid-only",
          songId: "song-public-no-lyrics",
          format: "grid",
          key: "D",
          timeSignature: "4/4",
          sections: [],
        },
      ],
    );

    const ids = new Set((await listPublicSongs(prisma)).map((song) => song.id));
    expect(ids.has("song-public-list")).toBe(true);
    expect(ids.has("song-private-list")).toBe(false);
    expect(ids.has("song-public-no-lyrics")).toBe(false);
  });

  it("returns undefined for non-public songs (AUTH-38)", async () => {
    await seedSong(
      baseSong("song-hidden-lyrics", "Oculta", false),
      [
        {
          id: "chart-hidden-lyrics",
          songId: "song-hidden-lyrics",
          format: "lyrics",
          key: "A",
          timeSignature: "4/4",
          sections: SECTIONS_WITH_CHORDS,
        },
      ],
    );

    await expect(getPublicLyrics(prisma, "song-hidden-lyrics")).resolves.toBeUndefined();
  });

  it("uses the most recently updated lyrics chart (AUTH-36)", async () => {
    await seedSong(
      baseSong("song-multi-chart", "Duas letras", true),
      [
        {
          id: "chart-older-lyrics",
          songId: "song-multi-chart",
          format: "lyrics",
          key: "E",
          timeSignature: "4/4",
          sections: [
            {
              id: "old",
              type: "verse",
              label: "Antigo",
              content: { lines: [{ text: "Letra antiga", chords: [] }] },
            },
          ],
        },
      ],
    );

    await prisma.chordChart.update({
      where: { id: "chart-older-lyrics" },
      data: { updatedAt: new Date("2020-01-01T00:00:00.000Z") },
    });

    await repository.saveChart({
      id: "chart-newer-lyrics",
      songId: "song-multi-chart",
      format: "lyrics",
      key: "F",
      timeSignature: "4/4",
      sections: [
        {
          id: "new",
          type: "verse",
          label: "Novo",
          content: { lines: [{ text: "Letra nova", chords: [] }] },
        },
      ],
    });

    await prisma.chordChart.update({
      where: { id: "chart-newer-lyrics" },
      data: { updatedAt: new Date("2025-06-01T00:00:00.000Z") },
    });

    const lyrics = await getPublicLyrics(prisma, "song-multi-chart");
    expect(lyrics?.sections).toEqual([{ label: "Novo", lines: ["Letra nova"] }]);
  });
});
