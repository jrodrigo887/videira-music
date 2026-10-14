import { describe, expect, it } from "vitest";

import type { ChordChart, Song } from "@/types/music";

import { InMemoryMusicRepository } from "./music-repository";

const SONG: Song = {
  id: "song-local-1",
  title: "Canção local",
  label: "Canção local",
  artist: "Artista local",
  defaultKey: "C",
  alternateKeys: [],
  meta: "",
};

const CHART: ChordChart = {
  id: "chart-local-1",
  songId: SONG.id,
  format: "lyrics",
  key: "C",
  timeSignature: "4/4",
  sections: [],
  origin: {
    kind: "url",
    url: "https://www.cifraclub.com.br/artista/cancao/",
    sourceName: "Cifra Club",
  },
};

describe("InMemoryMusicRepository", () => {
  it("saves and queries songs and charts through the feature contracts", async () => {
    const repository = new InMemoryMusicRepository();

    await repository.saveSong(SONG);
    await repository.saveChart(CHART);

    await expect(repository.listSongs()).resolves.toEqual([SONG]);
    await expect(repository.findSongById(SONG.id)).resolves.toEqual(SONG);
    await expect(repository.listChartsBySong(SONG.id)).resolves.toEqual([CHART]);
    await expect(repository.findChartByOriginUrl(CHART.origin?.url ?? "")).resolves.toEqual(CHART);
  });

  it("saves an optional song and chart through one atomic boundary", async () => {
    const repository = new InMemoryMusicRepository();

    await repository.saveSongAndChart(SONG, CHART);

    await expect(repository.listSongs()).resolves.toEqual([SONG]);
    await expect(repository.listChartsBySong(SONG.id)).resolves.toEqual([CHART]);
  });

  it("injects repository failures without changing existing state", async () => {
    const repository = new InMemoryMusicRepository([SONG], [CHART]);
    const failure = new Error("storage unavailable");
    repository.setFailure(failure);

    await expect(repository.saveSongAndChart({ ...SONG, id: "song-local-2" }, {
      ...CHART,
      id: "chart-local-2",
      songId: "song-local-2",
    })).rejects.toBe(failure);

    repository.setFailure();
    await expect(repository.listSongs()).resolves.toEqual([SONG]);
    await expect(repository.listChartsBySong(SONG.id)).resolves.toEqual([CHART]);
  });
});
