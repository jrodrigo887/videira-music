import { describe, expect, it, vi } from "vitest";

import { InMemoryMusicRepository } from "@/lib/persistence/music-repository";
import type { ImportDraft } from "@/types/import";
import type { ChordChart, Song } from "@/types/music";

import { saveImportedChart } from "./save-imported-chart";

const EXISTING_SONG: Song = {
  id: "12",
  title: "Canção existente",
  label: "Canção existente",
  artist: "Artista local",
  defaultKey: "G",
  alternateKeys: [],
  meta: "",
};

const DRAFT: ImportDraft = {
  id: "import-1",
  origin: { kind: "paste" },
  rawText: "[Verso]\nG\nLetra inventada",
  song: { title: "Canção nova", artist: "Outro artista", defaultKey: "G" },
  chart: {
    format: "lyrics",
    key: "G",
    timeSignature: "4/4",
    sections: [],
    source: "[Verso]\nG\nLetra inventada",
    origin: { kind: "paste" },
  },
  warnings: [],
  stats: { sections: 1, lyricLines: 1, chords: 1, linesIgnored: 0 },
};

class ConcurrencyProbeRepository extends InMemoryMusicRepository {
  readonly started: string[] = [];
  maxActiveWrites = 0;
  private activeWrites = 0;
  private releaseFirstWrite!: () => void;
  private readonly firstWriteGate = new Promise<void>((resolve) => {
    this.releaseFirstWrite = resolve;
  });

  releaseFirst(): void {
    this.releaseFirstWrite();
  }

  override async saveSongAndChart(
    song: Song | undefined,
    chart: ChordChart,
  ): Promise<void> {
    this.activeWrites += 1;
    this.maxActiveWrites = Math.max(this.maxActiveWrites, this.activeWrites);
    this.started.push(song?.title ?? chart.id);

    try {
      if (this.started.length === 1) {
        await this.firstWriteGate;
      }
      await super.saveSongAndChart(song, chart);
    } finally {
      this.activeWrites -= 1;
    }
  }
}

class FailOnceRepository extends InMemoryMusicRepository {
  private writes = 0;

  override async saveSongAndChart(
    song: Song | undefined,
    chart: ChordChart,
  ): Promise<void> {
    this.writes += 1;
    if (this.writes === 1) {
      throw new Error("first write failed");
    }
    await super.saveSongAndChart(song, chart);
  }
}

describe("saveImportedChart", () => {
  it("rejects drafts without a selected song key", async () => {
    const repository = new InMemoryMusicRepository([EXISTING_SONG]);

    await expect(
      saveImportedChart(
        { draft: DRAFT, song: { kind: "existing", songId: EXISTING_SONG.id } },
        repository,
      ),
    ).rejects.toThrow("Selecione o tom");
  });

  it("rejects drafts without a song selection", async () => {
    const repository = new InMemoryMusicRepository([EXISTING_SONG]);

    await expect(
      saveImportedChart({ draft: DRAFT, selectedSongKey: "G" }, repository),
    ).rejects.toThrow("Selecione ou crie uma música");
  });

  it("records the selected key on an existing song without changing the imported chart key", async () => {
    const repository = new InMemoryMusicRepository([EXISTING_SONG]);

    const result = await saveImportedChart(
      {
        draft: DRAFT,
        selectedSongKey: "A",
        song: { kind: "existing", songId: EXISTING_SONG.id },
      },
      repository,
    );

    expect(result.song).toMatchObject({ ...EXISTING_SONG, defaultKey: "A" });
    expect(result.chart).toMatchObject({ songId: EXISTING_SONG.id, key: "G" });
    await expect(repository.findSongById(EXISTING_SONG.id)).resolves.toMatchObject({
      defaultKey: "A",
    });
    await expect(repository.listChartsBySong(EXISTING_SONG.id)).resolves.toEqual([result.chart]);
  });

  it("stores the version chosen when saving the chart", async () => {
    const repository = new InMemoryMusicRepository([EXISTING_SONG]);

    const result = await saveImportedChart(
      {
        draft: DRAFT,
        selectedSongKey: "G",
        song: { kind: "existing", songId: EXISTING_SONG.id },
        versionLabel: "Ensaio de domingo",
      },
      repository,
    );

    expect(result.chart.versionLabel).toBe("Ensaio de domingo");
    await expect(repository.listChartsBySong(EXISTING_SONG.id)).resolves.toEqual([
      expect.objectContaining({ versionLabel: "Ensaio de domingo" }),
    ]);
  });

  it("creates non-numeric local IDs and persists the new song with its chart", async () => {
    const repository = new InMemoryMusicRepository();
    const randomUUID = vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("song-uuid")
      .mockReturnValueOnce("chart-uuid");

    const result = await saveImportedChart(
      {
        draft: DRAFT,
        selectedSongKey: "G",
        song: { kind: "new", title: "Canção nova", artist: "Outro artista" },
      },
      repository,
    );

    expect(result.song).toMatchObject({
      id: "song-local-song-uuid",
      title: "Canção nova",
      artist: "Outro artista",
      defaultKey: "G",
    });
    expect(result.chart).toMatchObject({
      id: "chart-local-chart-uuid",
      songId: "song-local-song-uuid",
    });
    await expect(repository.findSongById(result.song.id)).resolves.toEqual(result.song);
    await expect(repository.listChartsBySong(result.song.id)).resolves.toEqual([result.chart]);
    randomUUID.mockRestore();
  });

  it("leaves the draft unchanged when storage fails", async () => {
    const repository = new InMemoryMusicRepository([EXISTING_SONG]);
    const before = structuredClone(DRAFT);
    const failure = new Error("storage unavailable");
    repository.setFailure(failure);

    await expect(
      saveImportedChart(
        {
          draft: DRAFT,
          selectedSongKey: "G",
          song: { kind: "existing", songId: EXISTING_SONG.id },
        },
        repository,
      ),
    ).rejects.toBe(failure);

    expect(DRAFT).toEqual(before);
  });

  it("serializes concurrent saves and preserves both valid records", async () => {
    const repository = new ConcurrencyProbeRepository();
    const first = saveImportedChart(
      {
        draft: DRAFT,
        selectedSongKey: "G",
        song: { kind: "new", title: "Primeira" },
      },
      repository,
    );
    const second = saveImportedChart(
      {
        draft: { ...DRAFT, id: "import-2" },
        selectedSongKey: "A",
        song: { kind: "new", title: "Segunda" },
      },
      repository,
    );

    await vi.waitFor(() => expect(repository.started).toEqual(["Primeira"]));
    expect(repository.maxActiveWrites).toBe(1);
    repository.releaseFirst();

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(repository.started).toEqual(["Primeira", "Segunda"]);
    expect(repository.maxActiveWrites).toBe(1);
    await expect(repository.listSongs()).resolves.toEqual([
      firstResult.song,
      secondResult.song,
    ]);
    await expect(repository.listChartsBySong(firstResult.song.id)).resolves.toEqual([
      firstResult.chart,
    ]);
    await expect(repository.listChartsBySong(secondResult.song.id)).resolves.toEqual([
      secondResult.chart,
    ]);
  });

  it("continues the serialized queue after a failed write", async () => {
    const repository = new FailOnceRepository();
    const first = saveImportedChart(
      {
        draft: DRAFT,
        selectedSongKey: "G",
        song: { kind: "new", title: "Falha" },
      },
      repository,
    );
    const second = saveImportedChart(
      {
        draft: { ...DRAFT, id: "import-after-failure" },
        selectedSongKey: "A",
        song: { kind: "new", title: "Persistida" },
      },
      repository,
    );

    await expect(first).rejects.toThrow("first write failed");
    const result = await second;
    await expect(repository.listSongs()).resolves.toEqual([result.song]);
    await expect(repository.listChartsBySong(result.song.id)).resolves.toEqual([
      result.chart,
    ]);
  });
});
