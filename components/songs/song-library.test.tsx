// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/lib/persistence/local-data-migration", () => ({
  runLocalDataMigration: vi.fn(async () => ({ status: "skipped" as const })),
}));

afterEach(cleanup);

describe("SongLibrary", () => {
  it("lists songs from the repository", async () => {
    render(
      <SongLibrary repository={new InMemoryMusicRepository([SEED_SONG, LOCAL_SONG])} />,
    );

    expect(await screen.findByText("Nova Local")).toBeInTheDocument();
    expect(screen.getByText("Seed Primeiro")).toBeInTheDocument();
    expect(screen.getByText("2 músicas no catálogo")).toBeInTheDocument();
  });

  it.each([
    ["Nova Local", "title"],
    ["Banda da Casa", "artist"],
    ["F#", "key"],
  ])("finds a song by %s (%s)", async (query) => {
    render(
      <SongLibrary repository={new InMemoryMusicRepository([SEED_SONG, LOCAL_SONG])} />,
    );
    await screen.findByText("Nova Local");

    fireEvent.change(screen.getByRole("textbox"), { target: { value: query } });

    expect(screen.getByText("Nova Local")).toBeInTheDocument();
    expect(screen.queryByText("Seed Primeiro")).not.toBeInTheDocument();
  });

  it("shows an error and retry when loading fails", async () => {
    const repository = new InMemoryMusicRepository([SEED_SONG]);
    repository.setFailure(new Error("storage unavailable"));
    render(<SongLibrary repository={repository} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar o catálogo",
    );
    repository.setFailure();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.getByText("Seed Primeiro")).toBeInTheDocument());
  });
});
