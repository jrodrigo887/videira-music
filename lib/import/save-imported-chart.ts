import type { MusicRepository } from "@/lib/persistence/music-repository";
import type { ImportDraft } from "@/types/import";
import type { ChordChart, Song, SongId } from "@/types/music";

type SongSelection =
  | {
      kind: "existing";
      songId: SongId;
    }
  | {
      kind: "new";
      title: string;
      artist?: string;
    };

export type SaveImportedChartInput = {
  draft: ImportDraft;
  confirmedKey?: string;
  song?: SongSelection;
};

export type SaveImportedChartResult = {
  song: Song;
  chart: ChordChart;
};

function createLocalSong(
  selection: Extract<SongSelection, { kind: "new" }>,
  confirmedKey: string,
): Song {
  return {
    id: `song-local-${crypto.randomUUID()}`,
    title: selection.title,
    label: selection.title,
    ...(selection.artist ? { artist: selection.artist } : {}),
    defaultKey: confirmedKey,
    alternateKeys: [],
    meta: "",
  };
}

export async function saveImportedChart(
  input: SaveImportedChartInput,
  repository: MusicRepository,
): Promise<SaveImportedChartResult> {
  if (!input.confirmedKey?.trim()) {
    throw new Error("Confirme o tom antes de salvar.");
  }

  if (!input.song) {
    throw new Error("Selecione ou crie uma música antes de salvar.");
  }

  const isNewSong = input.song.kind === "new";
  const song = isNewSong
    ? createLocalSong(input.song, input.confirmedKey)
    : await repository.findSongById(input.song.songId);

  if (!song) {
    throw new Error("A música selecionada não foi encontrada.");
  }

  const chart: ChordChart = {
    ...input.draft.chart,
    id: `chart-local-${crypto.randomUUID()}`,
    songId: song.id,
    key: input.confirmedKey,
  };

  await repository.saveSongAndChart(isNewSong ? song : undefined, chart);

  return { song, chart };
}
