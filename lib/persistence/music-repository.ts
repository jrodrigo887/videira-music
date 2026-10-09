import type { ChordChart, Song, SongId } from "@/types/music";

export type SongRepository = {
  listSongs(): Promise<Song[]>;
  findSongById(id: SongId): Promise<Song | undefined>;
  saveSong(song: Song): Promise<void>;
};

export type ChartRepository = {
  listChartsBySong(songId: SongId): Promise<ChordChart[]>;
  findChartByOriginUrl(url: string): Promise<ChordChart | undefined>;
  saveChart(chart: ChordChart): Promise<void>;
};

export type MusicRepository = SongRepository &
  ChartRepository & {
    saveSongAndChart(song: Song | undefined, chart: ChordChart): Promise<void>;
  };

export class InMemoryMusicRepository implements MusicRepository {
  private readonly songs = new Map<SongId, Song>();
  private readonly charts = new Map<string, ChordChart>();
  private failure?: Error;

  constructor(songs: Song[] = [], charts: ChordChart[] = []) {
    songs.forEach((song) => this.songs.set(song.id, song));
    charts.forEach((chart) => this.charts.set(chart.id, chart));
  }

  setFailure(failure?: Error): void {
    this.failure = failure;
  }

  async listSongs(): Promise<Song[]> {
    this.assertAvailable();
    return [...this.songs.values()];
  }

  async findSongById(id: SongId): Promise<Song | undefined> {
    this.assertAvailable();
    return this.songs.get(id);
  }

  async saveSong(song: Song): Promise<void> {
    this.assertAvailable();
    this.songs.set(song.id, song);
  }

  async listChartsBySong(songId: SongId): Promise<ChordChart[]> {
    this.assertAvailable();
    return [...this.charts.values()].filter((chart) => chart.songId === songId);
  }

  async findChartByOriginUrl(url: string): Promise<ChordChart | undefined> {
    this.assertAvailable();
    return [...this.charts.values()].find((chart) => chart.origin?.url === url);
  }

  async saveChart(chart: ChordChart): Promise<void> {
    this.assertAvailable();
    this.charts.set(chart.id, chart);
  }

  async saveSongAndChart(song: Song | undefined, chart: ChordChart): Promise<void> {
    this.assertAvailable();

    if (song) {
      this.songs.set(song.id, song);
    }
    this.charts.set(chart.id, chart);
  }

  private assertAvailable(): void {
    if (this.failure) {
      throw this.failure;
    }
  }
}
