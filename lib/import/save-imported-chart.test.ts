import { describe, expect, it, vi } from "vitest";

import { InMemoryMusicRepository } from "@/lib/persistence/music-repository";
import type { ImportDraft } from "@/types/import";
import type { Song } from "@/types/music";

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

describe("saveImportedChart", () => {
  it("rejects drafts without explicit key confirmation", async () => {
    const repository = new InMemoryMusicRepository([EXISTING_SONG]);

    await expect(
      saveImportedChart(
        { draft: DRAFT, song: { kind: "existing", songId: EXISTING_SONG.id } },
        repository,
      ),
    ).rejects.toThrow("Confirme o tom");
  });

  it("rejects drafts without a song selection", async () => {
    const repository = new InMemoryMusicRepository([EXISTING_SONG]);

    await expect(
      saveImportedChart({ draft: DRAFT, confirmedKey: "G" }, repository),
    ).rejects.toThrow("Selecione ou crie uma música");
  });

  it("links the chart to the explicitly selected existing song", async () => {
    const repository = new InMemoryMusicRepository([EXISTING_SONG]);

    const result = await saveImportedChart(
      {
        draft: DRAFT,
        confirmedKey: "A",
        song: { kind: "existing", songId: EXISTING_SONG.id },
      },
      repository,
    );

    expect(result.song).toEqual(EXISTING_SONG);
    expect(result.chart).toMatchObject({ songId: EXISTING_SONG.id, key: "A" });
    await expect(repository.listChartsBySong(EXISTING_SONG.id)).resolves.toEqual([result.chart]);
  });

  it("creates non-numeric local IDs and persists the new song with its chart", async () => {
    const repository = new InMemoryMusicRepository();
    const randomUUID = vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("song-uuid")
      .mockReturnValueOnce("chart-uuid");

    const result = await saveImportedChart(
      {
        draft: DRAFT,
        confirmedKey: "G",
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
          confirmedKey: "G",
          song: { kind: "existing", songId: EXISTING_SONG.id },
        },
        repository,
      ),
    ).rejects.toBe(failure);

    expect(DRAFT).toEqual(before);
  });
});
