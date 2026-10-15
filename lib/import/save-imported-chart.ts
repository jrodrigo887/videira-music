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
  selectedSongKey?: string;
  song?: SongSelection;
  publicLyrics?: boolean;
};

export type SaveImportedChartResult = {
  song: Song;
  chart: ChordChart;
};

const repositoryWriteQueues = new WeakMap<MusicRepository, Promise<void>>();

function serializeRepositoryWrite(
  repository: MusicRepository,
  write: () => Promise<void>,
): Promise<void> {
  const previous = repositoryWriteQueues.get(repository) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(write);
  repositoryWriteQueues.set(repository, current);

  return current.finally(() => {
    if (repositoryWriteQueues.get(repository) === current) {
      repositoryWriteQueues.delete(repository);
    }
  });
}

function createLocalSong(
  selection: Extract<SongSelection, { kind: "new" }>,
  selectedSongKey: string,
): Song {
  return {
    id: `song-local-${crypto.randomUUID()}`,
    title: selection.title,
    label: selection.title,
    ...(selection.artist ? { artist: selection.artist } : {}),
    defaultKey: selectedSongKey,
    alternateKeys: [],
    meta: "",
    publicLyrics: false,
  };
}

export async function saveImportedChart(
  input: SaveImportedChartInput,
  repository: MusicRepository,
): Promise<SaveImportedChartResult> {
  const selectedSongKey = input.selectedSongKey?.trim();
  if (!selectedSongKey) {
    throw new Error("Selecione o tom da música antes de salvar.");
  }

  if (!input.song) {
    throw new Error("Selecione ou crie uma música antes de salvar.");
  }

  let song: Song | undefined;
  let songToSave: Song | undefined;

  const publicLyrics = input.publicLyrics ?? false;

  if (input.song.kind === "new") {
    song = { ...createLocalSong(input.song, selectedSongKey), publicLyrics };
    songToSave = song;
  } else {
    song = await repository.findSongById(input.song.songId);
    if (song) {
      song = { ...song, defaultKey: selectedSongKey, publicLyrics };
      songToSave = song;
    }
  }

  if (!song) {
    throw new Error("A música selecionada não foi encontrada.");
  }

  const chart: ChordChart = {
    ...input.draft.chart,
    id: `chart-local-${crypto.randomUUID()}`,
    songId: song.id,
  };

  await serializeRepositoryWrite(
    repository,
    () => repository.saveSongAndChart(songToSave, chart),
  );

  return { song, chart };
}
