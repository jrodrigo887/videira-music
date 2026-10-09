import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";

import type { ChordChart, Song } from "@/types/music";

import { IndexedDbMusicRepository } from "./music-database";

const SONG: Song = {
  id: "song-local-1",
  title: "Canção local",
  label: "Canção local",
  artist: "Artista local",
  defaultKey: "D",
  alternateKeys: [],
  meta: "",
};

const CHART: ChordChart = {
  id: "chart-local-1",
  songId: SONG.id,
  format: "lyrics",
  key: "D",
  timeSignature: "4/4",
  sections: [],
  origin: {
    kind: "url",
    url: "https://www.cifraclub.com.br/artista/cancao/#chart",
    sourceName: "Cifra Club",
  },
};

describe("IndexedDbMusicRepository", () => {
  it("creates the song and origin URL chart indexes", async () => {
    const indexedDB = new IDBFactory();
    const repository = new IndexedDbMusicRepository({ indexedDB, databaseName: "indexes" });
    await repository.listSongs();
    repository.close();

    const request = indexedDB.open("indexes");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
    });
    const transaction = database.transaction("charts", "readonly");

    expect([...transaction.objectStore("charts").indexNames]).toEqual(["originUrl", "songId"]);
    database.close();
  });

  it("restores songs and charts after the database is reopened", async () => {
    const indexedDB = new IDBFactory();
    const first = new IndexedDbMusicRepository({ indexedDB, databaseName: "reopen" });
    await first.saveSongAndChart(SONG, CHART);
    first.close();

    const reopened = new IndexedDbMusicRepository({ indexedDB, databaseName: "reopen" });

    await expect(reopened.listSongs()).resolves.toEqual([SONG]);
    await expect(reopened.findSongById(SONG.id)).resolves.toEqual(SONG);
    await expect(reopened.listChartsBySong(SONG.id)).resolves.toEqual([CHART]);
    reopened.close();
  });

  it("finds charts through the canonical origin URL index", async () => {
    const repository = new IndexedDbMusicRepository({
      indexedDB: new IDBFactory(),
      databaseName: "origin-index",
    });
    await repository.saveChart(CHART);

    await expect(
      repository.findChartByOriginUrl("https://www.cifraclub.com.br/artista/cancao/"),
    ).resolves.toEqual(CHART);
    repository.close();
  });

  it("rolls back the song when the chart cannot be persisted", async () => {
    const repository = new IndexedDbMusicRepository({
      indexedDB: new IDBFactory(),
      databaseName: "rollback",
    });
    const invalidChart = {
      ...CHART,
      source: (() => undefined) as unknown as string,
    };

    await expect(repository.saveSongAndChart(SONG, invalidChart)).rejects.toBeInstanceOf(Error);
    await expect(repository.findSongById(SONG.id)).resolves.toBeUndefined();
    await expect(repository.listChartsBySong(SONG.id)).resolves.toEqual([]);
    repository.close();
  });
});
