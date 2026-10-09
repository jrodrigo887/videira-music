// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InMemoryMusicRepository } from "@/lib/persistence/music-repository";
import type { Song } from "@/types/music";

import { SongLibrary } from "./song-library";

const SEED_SONG: Song = {
  id: "1",
  title: "Seed Primeiro",
  label: "Seed Primeiro",
  artist: "Artista Seed",
  defaultKey: "C",
  alternateKeys: [],
  meta: "Catálogo inicial",
};

const LOCAL_SONG: Song = {
  id: "song-local-1",
  title: "Nova Local",
  label: "Nova Local",
  artist: "Banda da Casa",
  defaultKey: "F#",
  alternateKeys: [],
  meta: "Importada",
};

afterEach(cleanup);

describe("SongLibrary", () => {
  it("keeps seed order and appends each non-duplicate local song once", async () => {
    const duplicateSeed = { ...SEED_SONG, title: "Não deve substituir" };
    render(
      <SongLibrary
        initialSongs={[SEED_SONG]}
        repository={new InMemoryMusicRepository([duplicateSeed, LOCAL_SONG])}
      />,
    );

    expect(await screen.findByText("Nova Local")).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/songs/1",
      "/songs/song-local-1",
    ]);
    expect(screen.queryByText("Não deve substituir")).not.toBeInTheDocument();
    expect(screen.getByText("2 músicas no catálogo")).toBeInTheDocument();
  });

  it.each([
    ["Nova Local", "title"],
    ["Banda da Casa", "artist"],
    ["F#", "key"],
  ])("finds a local song by %s (%s)", async (query) => {
    render(
      <SongLibrary
        initialSongs={[SEED_SONG]}
        repository={new InMemoryMusicRepository([LOCAL_SONG])}
      />,
    );
    await screen.findByText("Nova Local");

    fireEvent.change(screen.getByRole("textbox"), { target: { value: query } });

    expect(screen.getByText("Nova Local")).toBeInTheDocument();
    expect(screen.queryByText("Seed Primeiro")).not.toBeInTheDocument();
  });

  it("keeps seed songs visible and shows a warning when local storage fails", async () => {
    const repository = new InMemoryMusicRepository();
    repository.setFailure(new Error("storage unavailable"));
    render(<SongLibrary initialSongs={[SEED_SONG]} repository={repository} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dados locais não puderam ser carregados",
    );
    expect(screen.getByText("Seed Primeiro")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("1 música no catálogo")).toBeInTheDocument());
  });
});
