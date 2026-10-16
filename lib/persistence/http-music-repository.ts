import type { ChordChart, ChordChartId, Song, SongId } from "@/types/music";

import type { MusicRepository } from "./music-repository";
import { RepositoryError, type ValidationIssue } from "./repository-error";

const REQUEST_TIMEOUT_MS = 15_000;

type ErrorBody = {
  error: {
    code: string;
    message: string;
    issues?: ValidationIssue[];
    existingChartId?: string;
  };
};

export type HttpMusicRepositoryOptions = {
  fetch?: typeof fetch;
  baseUrl?: string;
};

export class HttpMusicRepository implements MusicRepository {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(options: HttpMusicRepositoryOptions = {}) {
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.baseUrl = options.baseUrl ?? "";
  }

  async listSongs(): Promise<Song[]> {
    const response = await this.request("/api/songs");
    const body = (await response.json()) as { songs: Song[] };
    return body.songs;
  }

  async findSongById(id: SongId): Promise<Song | undefined> {
    const response = await this.request(`/api/songs/${encodeURIComponent(id)}`, {
      allowNotFound: true,
    });
    if (response.status === 404) {
      return undefined;
    }
    const body = (await response.json()) as { song: Song };
    return body.song;
  }

  async saveSong(song: Song): Promise<void> {
    await this.request(`/api/songs/${encodeURIComponent(song.id)}`, {
      method: "PUT",
      body: JSON.stringify(song),
    });
  }

  async listChartsBySong(songId: SongId): Promise<ChordChart[]> {
    const response = await this.request(
      `/api/songs/${encodeURIComponent(songId)}/charts`,
    );
    const body = (await response.json()) as { charts: ChordChart[] };
    return body.charts;
  }

  async findChartById(_id: ChordChartId): Promise<ChordChart | undefined> {
    return undefined;
  }

  async findChartByOriginUrl(url: string): Promise<ChordChart | undefined> {
    const response = await this.request(
      `/api/charts?originUrl=${encodeURIComponent(url)}`,
      { allowNotFound: true },
    );
    if (response.status === 404) {
      return undefined;
    }
    const body = (await response.json()) as { chart: ChordChart };
    return body.chart;
  }

  async saveChart(chart: ChordChart): Promise<void> {
    await this.request(`/api/charts/${encodeURIComponent(chart.id)}`, {
      method: "PUT",
      body: JSON.stringify(chart),
    });
  }

  async saveSongAndChart(song: Song | undefined, chart: ChordChart): Promise<void> {
    await this.request("/api/song-charts", {
      method: "POST",
      body: JSON.stringify({ song, chart }),
    });
  }

  private async request(
    path: string,
    options: {
      method?: string;
      body?: string;
      allowNotFound?: boolean;
    } = {},
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: options.method ?? "GET",
        headers: options.body ? { "Content-Type": "application/json" } : undefined,
        body: options.body,
        signal: controller.signal,
      });
      if (response.ok || (options.allowNotFound && response.status === 404)) {
        return response;
      }
      throw await this.toRepositoryError(response);
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new RepositoryError("NETWORK_TIMEOUT", 0, "Tempo de rede esgotado.");
      }
      throw new RepositoryError("NETWORK_TIMEOUT", 0, "Falha de rede.");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async toRepositoryError(response: Response): Promise<RepositoryError> {
    let body: ErrorBody | undefined;
    try {
      body = (await response.json()) as ErrorBody;
    } catch {
      // ignore
    }
    const code = body?.error.code ?? "PERSISTENCE_FAILED";
    const message = body?.error.message ?? "Falha ao acessar o servidor.";
    return new RepositoryError(code, response.status, message, {
      issues: body?.error.issues,
      existingChartId: body?.error.existingChartId,
    });
  }
}
