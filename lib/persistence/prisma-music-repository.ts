import type { PrismaClient } from "@prisma/client";

import type { ChordChart, Song, SongId } from "@/types/music";

import type { MusicRepository } from "./music-repository";
import {
  OriginUrlConflictError,
  SongNotFoundError,
} from "./repository-error";
import {
  canonicalizeOriginUrl,
  toDomainChart,
  toDomainSong,
  toPrismaChartCreate,
  toPrismaSongCreate,
} from "./persistence-utils";

type PrismaMusicRepositoryOptions = {
  organizationId: string;
};

export class PrismaMusicRepository implements MusicRepository {
  private readonly organizationId: string;

  constructor(
    private readonly prisma: PrismaClient,
    options: PrismaMusicRepositoryOptions,
  ) {
    this.organizationId = options.organizationId;
  }

  async listSongs(): Promise<Song[]> {
    const rows = await this.prisma.song.findMany({
      where: { organizationId: this.organizationId, deletedAt: null },
      orderBy: { title: "asc" },
    });
    return rows.map(toDomainSong);
  }

  async findSongById(id: SongId): Promise<Song | undefined> {
    const row = await this.prisma.song.findFirst({
      where: { id, organizationId: this.organizationId, deletedAt: null },
    });
    return row ? toDomainSong(row) : undefined;
  }

  async saveSong(song: Song): Promise<void> {
    const data = toPrismaSongCreate(song, this.organizationId);
    await this.prisma.song.upsert({
      where: { id: song.id },
      create: data,
      update: {
        title: data.title,
        label: data.label,
        artist: data.artist,
        genre: data.genre,
        defaultKey: data.defaultKey,
        alternateKeys: data.alternateKeys,
        notes: data.notes,
        meta: data.meta,
        searchText: data.searchText,
        publicLyrics: data.publicLyrics,
      },
    });
  }

  async listChartsBySong(songId: SongId): Promise<ChordChart[]> {
    const rows = await this.prisma.chordChart.findMany({
      where: { organizationId: this.organizationId, songId },
    });
    return rows.map(toDomainChart);
  }

  async findChartById(id: string): Promise<ChordChart | undefined> {
    const row = await this.prisma.chordChart.findFirst({
      where: { id, organizationId: this.organizationId },
    });
    return row ? toDomainChart(row) : undefined;
  }

  async findChartByOriginUrl(url: string): Promise<ChordChart | undefined> {
    const originUrl = canonicalizeOriginUrl(url);
    const row = await this.prisma.chordChart.findFirst({
      where: { organizationId: this.organizationId, originUrl },
    });
    return row ? toDomainChart(row) : undefined;
  }

  async saveChart(chart: ChordChart): Promise<void> {
    await this.assertSongExists(chart.songId);
    await this.assertOriginAvailable(chart);
    const data = toPrismaChartCreate(chart, this.organizationId);
    try {
      await this.prisma.chordChart.upsert({
        where: { id: chart.id },
        create: data,
        update: {
          songId: data.songId,
          title: data.title,
          format: data.format,
          key: data.key,
          timeSignature: data.timeSignature,
          tempo: data.tempo,
          capo: data.capo,
          sections: data.sections,
          source: data.source,
          origin: data.origin,
          originUrl: data.originUrl,
          schemaVersion: data.schemaVersion,
        },
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2003"
      ) {
        throw new SongNotFoundError();
      }
      throw await this.mapUniqueOriginError(error, chart);
    }
  }

  async saveSongAndChart(song: Song | undefined, chart: ChordChart): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const repo = new PrismaMusicRepository(tx as PrismaClient, {
        organizationId: this.organizationId,
      });
      if (song) {
        await repo.saveSong(song);
      } else {
        await repo.assertSongExists(chart.songId);
      }
      await repo.saveChart(chart);
    });
  }

  async migrateBatch(input: {
    songs: Song[];
    charts: ChordChart[];
  }): Promise<{
    songsCreated: number;
    songsSkipped: number;
    chartsCreated: number;
    chartsSkipped: number;
    failures: Array<{ id: string; code: string }>;
  }> {
    let songsCreated = 0;
    let songsSkipped = 0;
    let chartsCreated = 0;
    let chartsSkipped = 0;
    const failures: Array<{ id: string; code: string }> = [];

    const songIdsInBatch = new Set(input.songs.map((song) => song.id));

    for (const song of input.songs) {
      const existing = await this.findSongById(song.id);
      if (existing) {
        songsSkipped += 1;
        continue;
      }
      try {
        await this.saveSong(song);
        songsCreated += 1;
      } catch {
        failures.push({ id: song.id, code: "VALIDATION_FAILED" });
      }
    }

    const sortedCharts = [...input.charts].sort((left, right) => left.id.localeCompare(right.id));
    for (const chart of sortedCharts) {
      const existingChart = await this.prisma.chordChart.findFirst({
        where: { id: chart.id, organizationId: this.organizationId },
      });
      if (existingChart) {
        chartsSkipped += 1;
        continue;
      }

      const originUrl = chart.origin?.url ? canonicalizeOriginUrl(chart.origin.url) : undefined;
      if (originUrl) {
        const conflict = await this.prisma.chordChart.findFirst({
          where: { organizationId: this.organizationId, originUrl },
        });
        if (conflict) {
          chartsSkipped += 1;
          continue;
        }
      }

      const songExists =
        songIdsInBatch.has(chart.songId) ||
        Boolean(await this.findSongById(chart.songId));
      if (!songExists) {
        failures.push({ id: chart.id, code: "SONG_NOT_FOUND" });
        continue;
      }

      try {
        await this.saveChart(chart);
        chartsCreated += 1;
      } catch (error) {
        if (error instanceof OriginUrlConflictError) {
          chartsSkipped += 1;
          continue;
        }
        failures.push({ id: chart.id, code: "VALIDATION_FAILED" });
      }
    }

    return { songsCreated, songsSkipped, chartsCreated, chartsSkipped, failures };
  }

  private async assertSongExists(songId: SongId): Promise<void> {
    const song = await this.findSongById(songId);
    if (!song) {
      throw new SongNotFoundError();
    }
  }

  private async assertOriginAvailable(chart: ChordChart): Promise<void> {
    if (!chart.origin?.url) {
      return;
    }
    const originUrl = canonicalizeOriginUrl(chart.origin.url);
    const existing = await this.prisma.chordChart.findFirst({
      where: {
        organizationId: this.organizationId,
        originUrl,
        NOT: { id: chart.id },
      },
    });
    if (existing) {
      throw new OriginUrlConflictError(existing.id);
    }
  }

  private async mapUniqueOriginError(error: unknown, chart: ChordChart): Promise<unknown> {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const originUrl = chart.origin?.url ? canonicalizeOriginUrl(chart.origin.url) : undefined;
      if (originUrl) {
        const existing = await this.prisma.chordChart.findFirst({
          where: { organizationId: this.organizationId, originUrl },
        });
        if (existing) {
          return new OriginUrlConflictError(existing.id);
        }
      }
    }
    return error;
  }
}
