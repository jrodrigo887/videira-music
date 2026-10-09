import type { MusicRepository } from "@/lib/persistence/music-repository";
import type { ChordChart, Song, SongId } from "@/types/music";

const DATABASE_NAME = "videira-music";
const DATABASE_VERSION = 1;
const SONGS_STORE = "songs";
const CHARTS_STORE = "charts";
const SONG_ID_INDEX = "songId";
const ORIGIN_URL_INDEX = "originUrl";

type StoredChart = ChordChart & {
  originUrl?: string;
};

type DatabaseOptions = {
  databaseName?: string;
  indexedDB?: IDBFactory;
};

function canonicalizeOriginUrl(url: string): string {
  const canonical = new URL(url);
  canonical.hash = "";
  return canonical.href;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener(
      "abort",
      () => reject(transaction.error ?? new Error("IndexedDB transaction aborted")),
      { once: true },
    );
    transaction.addEventListener(
      "error",
      () => reject(transaction.error ?? new Error("IndexedDB transaction failed")),
      { once: true },
    );
  });
}

function toStoredChart(chart: ChordChart): StoredChart {
  const originUrl = chart.origin?.url
    ? canonicalizeOriginUrl(chart.origin.url)
    : undefined;
  return { ...chart, ...(originUrl ? { originUrl } : {}) };
}

function fromStoredChart(record: StoredChart): ChordChart {
  const { originUrl, ...chart } = record;
  void originUrl;
  return chart;
}

export class IndexedDbMusicRepository implements MusicRepository {
  private readonly databaseName: string;
  private readonly indexedDB: IDBFactory;
  private database?: IDBDatabase;
  private opening?: Promise<IDBDatabase>;

  constructor(options: DatabaseOptions = {}) {
    this.databaseName = options.databaseName ?? DATABASE_NAME;
    this.indexedDB = options.indexedDB ?? globalThis.indexedDB;
  }

  async listSongs(): Promise<Song[]> {
    const transaction = (await this.open()).transaction(SONGS_STORE, "readonly");
    return requestResult(transaction.objectStore(SONGS_STORE).getAll());
  }

  async findSongById(id: SongId): Promise<Song | undefined> {
    const transaction = (await this.open()).transaction(SONGS_STORE, "readonly");
    return requestResult(transaction.objectStore(SONGS_STORE).get(id));
  }

  async saveSong(song: Song): Promise<void> {
    const transaction = (await this.open()).transaction(SONGS_STORE, "readwrite");
    transaction.objectStore(SONGS_STORE).put(song);
    await transactionDone(transaction);
  }

  async listChartsBySong(songId: SongId): Promise<ChordChart[]> {
    const transaction = (await this.open()).transaction(CHARTS_STORE, "readonly");
    const records = await requestResult<StoredChart[]>(
      transaction.objectStore(CHARTS_STORE).index(SONG_ID_INDEX).getAll(songId),
    );
    return records.map(fromStoredChart);
  }

  async findChartByOriginUrl(url: string): Promise<ChordChart | undefined> {
    const transaction = (await this.open()).transaction(CHARTS_STORE, "readonly");
    const record = await requestResult<StoredChart | undefined>(
      transaction
        .objectStore(CHARTS_STORE)
        .index(ORIGIN_URL_INDEX)
        .get(canonicalizeOriginUrl(url)),
    );
    return record ? fromStoredChart(record) : undefined;
  }

  async saveChart(chart: ChordChart): Promise<void> {
    const transaction = (await this.open()).transaction(CHARTS_STORE, "readwrite");
    transaction.objectStore(CHARTS_STORE).put(toStoredChart(chart));
    await transactionDone(transaction);
  }

  async saveSongAndChart(song: Song | undefined, chart: ChordChart): Promise<void> {
    const transaction = (await this.open()).transaction(
      [SONGS_STORE, CHARTS_STORE],
      "readwrite",
    );

    try {
      if (song) {
        transaction.objectStore(SONGS_STORE).put(song);
      }
      transaction.objectStore(CHARTS_STORE).put(toStoredChart(chart));
    } catch (error) {
      transaction.abort();
      throw error;
    }

    await transactionDone(transaction);
  }

  close(): void {
    this.database?.close();
    this.database = undefined;
    this.opening = undefined;
  }

  private async open(): Promise<IDBDatabase> {
    if (this.database) {
      return this.database;
    }

    this.opening ??= new Promise((resolve, reject) => {
      const request = this.indexedDB.open(this.databaseName, DATABASE_VERSION);

      request.addEventListener("upgradeneeded", () => {
        const database = request.result;
        database.createObjectStore(SONGS_STORE, { keyPath: "id" });
        const charts = database.createObjectStore(CHARTS_STORE, { keyPath: "id" });
        charts.createIndex(SONG_ID_INDEX, SONG_ID_INDEX);
        charts.createIndex(ORIGIN_URL_INDEX, ORIGIN_URL_INDEX, { unique: false });
      });
      request.addEventListener(
        "success",
        () => {
          this.database = request.result;
          resolve(request.result);
        },
        { once: true },
      );
      request.addEventListener("error", () => reject(request.error), { once: true });
    });

    return this.opening;
  }
}
