import {
  DATABASE_NAME,
  IndexedDbMusicRepository,
  MIGRATION_MARKER_KEY,
} from "@/lib/persistence/music-database";
import type { ChordChart, Song } from "@/types/music";

import { MIGRATION_BODY_LIMIT_BYTES } from "./validate-persistence-input";

export type MigrationBatchResult = {
  songsCreated: number;
  songsSkipped: number;
  chartsCreated: number;
  chartsSkipped: number;
  failures: Array<{ id: string; code: string }>;
};

export type MigrationResult = {
  status: "skipped" | "completed" | "partial";
  message?: string;
  totals?: MigrationBatchResult;
};

type MigrationOptions = {
  fetch?: typeof fetch;
  localStorage?: Storage;
  indexedDB?: IDBFactory;
  postBatch?: (batch: { songs: Song[]; charts: ChordChart[] }) => Promise<MigrationBatchResult>;
};

function migrationCompleted(storage: Storage): boolean {
  return storage.getItem(MIGRATION_MARKER_KEY) === "completed";
}

function markMigrationCompleted(storage: Storage): void {
  storage.setItem(MIGRATION_MARKER_KEY, "completed");
}

function batchByteSize(batch: { songs: Song[]; charts: ChordChart[] }): number {
  return new TextEncoder().encode(JSON.stringify(batch)).byteLength;
}

export function groupMigrationBatches(input: {
  songs: Song[];
  charts: ChordChart[];
}): Array<{ songs: Song[]; charts: ChordChart[] }> {
  const chartsBySong = new Map<string, ChordChart[]>();
  for (const chart of input.charts) {
    const group = chartsBySong.get(chart.songId) ?? [];
    group.push(chart);
    chartsBySong.set(chart.songId, group);
  }

  const batches: Array<{ songs: Song[]; charts: ChordChart[] }> = [];
  let current: { songs: Song[]; charts: ChordChart[] } = { songs: [], charts: [] };

  const flush = () => {
    if (current.songs.length || current.charts.length) {
      batches.push(current);
      current = { songs: [], charts: [] };
    }
  };

  for (const song of input.songs) {
    const songCharts = chartsBySong.get(song.id) ?? [];
    const candidate = {
      songs: [...current.songs, song],
      charts: [...current.charts, ...songCharts],
    };
    if (batchByteSize(candidate) > MIGRATION_BODY_LIMIT_BYTES && (current.songs.length || current.charts.length)) {
      flush();
      current = { songs: [song], charts: songCharts };
    } else {
      current = candidate;
    }
    chartsBySong.delete(song.id);
  }

  flush();

  const orphanCharts = [...chartsBySong.values()].flat();
  if (orphanCharts.length) {
    batches.push({ songs: [], charts: orphanCharts });
  }

  return batches;
}

async function defaultPostBatch(batch: {
  songs: Song[];
  charts: ChordChart[];
}): Promise<MigrationBatchResult> {
  const response = await fetch("/api/migrations/local-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batch),
  });
  if (!response.ok) {
    throw new Error(`Migration batch failed with status ${response.status}`);
  }
  return (await response.json()) as MigrationBatchResult;
}

export async function runLocalDataMigration(
  options: MigrationOptions = {},
): Promise<MigrationResult> {
  const storage = options.localStorage ?? globalThis.localStorage;
  const indexedDB = options.indexedDB ?? globalThis.indexedDB;
  const postBatch = options.postBatch ?? defaultPostBatch;

  if (!storage || migrationCompleted(storage)) {
    return { status: "skipped" };
  }

  if (!indexedDB) {
    markMigrationCompleted(storage);
    return { status: "skipped" };
  }

  const repository = new IndexedDbMusicRepository({ indexedDB, databaseName: DATABASE_NAME });
  let exported: { songs: Song[]; charts: ChordChart[] };
  try {
    exported = await repository.exportAll();
  } catch {
    markMigrationCompleted(storage);
    return { status: "skipped" };
  }

  if (!exported.songs.length && !exported.charts.length) {
    markMigrationCompleted(storage);
    return { status: "skipped" };
  }

  const batches = groupMigrationBatches(exported);
  const totals: MigrationBatchResult = {
    songsCreated: 0,
    songsSkipped: 0,
    chartsCreated: 0,
    chartsSkipped: 0,
    failures: [],
  };

  for (const batch of batches) {
    try {
      const result = await postBatch(batch);
      totals.songsCreated += result.songsCreated;
      totals.songsSkipped += result.songsSkipped;
      totals.chartsCreated += result.chartsCreated;
      totals.chartsSkipped += result.chartsSkipped;
      totals.failures.push(...result.failures);
    } catch {
      return {
        status: "partial",
        message:
          "Parte dos dados locais não foi migrada. Tentaremos de novo na próxima abertura.",
        totals,
      };
    }
  }

  if (totals.failures.length) {
    return {
      status: "partial",
      message:
        "Parte dos dados locais não foi migrada. Tentaremos de novo na próxima abertura.",
      totals,
    };
  }

  markMigrationCompleted(storage);
  return {
    status: "completed",
    message: `Migração concluída: ${totals.songsCreated} músicas e ${totals.chartsCreated} cifras enviadas ao servidor; ${totals.songsSkipped + totals.chartsSkipped} já existiam.`,
    totals,
  };
}
