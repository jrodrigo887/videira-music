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

afterEach(cleanup);

describe("SongDetail", () => {
  it("resolves a numeric seed song and replaces demos with persisted charts", async () => {
    const chart = persistedChart(SEED_SONG.id);
    render(
      <SongDetail
        songId={SEED_SONG.id}
        seedSong={SEED_SONG}
        repository={new InMemoryMusicRepository([], [chart])}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Música Seed" })).toBeInTheDocument();
    expect(screen.getByText("Cifra persistida")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Cifra Club" })).toHaveAttribute(
      "href",
      chart.origin?.url,
    );

    const chordLine = document.querySelector(".music-chords");
    expect(chordLine).toHaveTextContent("G");
    fireEvent.click(screen.getByRole("button", { name: "+1" }));
    expect(chordLine).toHaveTextContent("G#");
  });

  it("resolves a local song and its persisted chart after hydration", async () => {
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

  it("shows not-found only after local lookup completes", async () => {
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

  it("keeps seed detail visible and warns when local storage fails", async () => {
    const repository = new InMemoryMusicRepository();
    repository.setFailure(new Error("storage unavailable"));
    render(
      <SongDetail
        songId={SEED_SONG.id}
        seedSong={SEED_SONG}
        repository={repository}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cifras locais não puderam ser carregadas",
    );
    expect(screen.getByRole("heading", { level: 1, name: "Música Seed" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Cifras de exemplo")).toBeInTheDocument());
  });
});
