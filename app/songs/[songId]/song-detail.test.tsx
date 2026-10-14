// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InMemoryMusicRepository } from "@/lib/persistence/music-repository";
import type { ChordChart, Song } from "@/types/music";

import { SongDetail } from "./song-detail";

const SEED_SONG: Song = {
  id: "1",
  title: "Música Seed",
  label: "Música Seed",
  artist: "Artista Seed",
  defaultKey: "G",
  alternateKeys: [],
  meta: "Catálogo inicial",
};

const LOCAL_SONG: Song = {
  id: "song-local-1",
  title: "Música Local",
  label: "Música Local",
  artist: "Artista Local",
  defaultKey: "G",
  alternateKeys: [],
  meta: "Importada",
};

function persistedChart(songId: string): ChordChart {
  return {
    id: `chart-${songId}`,
    songId,
    title: "Cifra persistida",
    format: "lyrics",
    key: "G",
    timeSignature: "4/4",
    sections: [
      {
        id: "section-1",
        type: "verse",
        label: "Verso",
        content: {
          lines: [{ text: "Letra inventada", chords: [{ symbol: "G", position: 0 }] }],
        },
      },
    ],
    origin: {
      kind: "url",
      url: "https://www.cifraclub.com.br/artista/cancao/",
      sourceName: "Cifra Club",
      fetchedAt: "2026-10-09T12:00:00.000Z",
    },
  };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("SongDetail", () => {
  it("uses setlist-scoped transpose without affecting the global song preference", async () => {
    const chart = persistedChart(SEED_SONG.id);
    localStorage.setItem(
      "videira-music:song-transpose",
      JSON.stringify({
        [SEED_SONG.id]: { semitones: 4 },
        "setlist:sl-1:item:item-1": { semitones: 1 },
      }),
    );

    render(
      <SongDetail
        songId={SEED_SONG.id}
        setlistContext={{
          setlistId: "sl-1",
          setlistItemId: "item-1",
          selectedKey: "A",
        }}
        repository={new InMemoryMusicRepository([SEED_SONG], [chart])}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Música Seed" })).toBeInTheDocument();

    await waitFor(() => {
      const chordLine = document.querySelector(".music-chords");
      expect(chordLine).toHaveTextContent("G#");
    });
  });

  it("restores the last selected transpose offset when reopening the song", async () => {
    const chart = persistedChart(SEED_SONG.id);
    localStorage.setItem(
      "videira-music:song-transpose",
      JSON.stringify({ [SEED_SONG.id]: { semitones: 2 } }),
    );

    render(
      <SongDetail
        songId={SEED_SONG.id}
        repository={new InMemoryMusicRepository([SEED_SONG], [chart])}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Música Seed" })).toBeInTheDocument();

    await waitFor(() => {
      const chordLine = document.querySelector(".music-chords");
      expect(chordLine).toHaveTextContent("A");
    });
  });

  it("loads a seed song and replaces demos with persisted charts", async () => {
    const chart = persistedChart(SEED_SONG.id);
    render(
      <SongDetail
        songId={SEED_SONG.id}
        repository={new InMemoryMusicRepository([SEED_SONG], [chart])}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Música Seed" })).toBeInTheDocument();
    expect(screen.getByText("Cifra persistida")).toBeInTheDocument();
    expect(screen.getByText("Cifras importadas")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);

    const chordLine = document.querySelector(".music-chords");
    expect(chordLine).toHaveTextContent("G");
    fireEvent.click(screen.getByRole("button", { name: "Aumentar meio-tom" }));
    expect(chordLine).toHaveTextContent("G#");
  });

  it("loads a local song and its persisted chart", async () => {
    const chart = persistedChart(LOCAL_SONG.id);
    render(
      <SongDetail
        songId={LOCAL_SONG.id}
        repository={new InMemoryMusicRepository([LOCAL_SONG], [chart])}
      />,
    );

    expect(screen.getByText("Carregando música…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Música Local" })).toBeInTheDocument();
    expect(screen.getByText("Cifra persistida")).toBeInTheDocument();
  });

  it("shows not-found only after lookup completes", async () => {
    render(
      <SongDetail
        songId="song-local-missing"
        repository={new InMemoryMusicRepository()}
      />,
    );

    expect(screen.getByText("Carregando música…")).toBeInTheDocument();
    expect(screen.queryByText("Música não encontrada")).not.toBeInTheDocument();
    expect(await screen.findByText("Música não encontrada")).toBeInTheDocument();
  });

  it("shows a retryable error when the repository fails", async () => {
    const repository = new InMemoryMusicRepository([SEED_SONG]);
    repository.setFailure(new Error("storage unavailable"));
    render(<SongDetail songId={SEED_SONG.id} repository={repository} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar a música. Tente novamente.",
    );
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    repository.setFailure();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Música Seed" })).toBeInTheDocument();
  });
});
