// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InMemoryMusicRepository, type MusicRepository } from "@/lib/persistence/music-repository";
import type { ImportDraft } from "@/types/import";
import type { ChordChart, Song } from "@/types/music";

import { ImportWorkflow } from "./import-workflow";

const SONG: Song = {
  id: "12",
  title: "Canção Teste",
  label: "Canção Teste",
  artist: "Artista",
  defaultKey: "G",
  alternateKeys: [],
  meta: "Artista · Tom G",
};

const TITLE_MATCH: Song = {
  ...SONG,
  id: "13",
  artist: "Outra banda",
};

const ARTIST_MATCH: Song = {
  ...SONG,
  id: "14",
  title: "Outro título",
  label: "Outro título",
};

const UNRELATED_SONG: Song = {
  ...SONG,
  id: "15",
  title: "Sem relação",
  label: "Sem relação",
  artist: "Pessoa distante",
};

const DRAFT: ImportDraft = {
  id: "import-1",
  origin: {
    kind: "url",
    url: "https://www.cifraclub.com.br/artista/cancao/",
    sourceName: "Cifra Club",
    fetchedAt: "2026-10-09T12:00:00.000Z",
  },
  rawText: "[Verso original]\nG\nLetra inventada",
  song: { title: "Canção Teste", artist: "Artista", defaultKey: "G" },
  chart: {
    title: "Canção Teste",
    format: "lyrics",
    key: "G",
    timeSignature: "4/4",
    source: "[Verso original]\nG\nLetra inventada",
    origin: {
      kind: "url",
      url: "https://www.cifraclub.com.br/artista/cancao/",
      sourceName: "Cifra Club",
      fetchedAt: "2026-10-09T12:00:00.000Z",
    },
    sections: [
      {
        id: "section-1",
        type: "verse",
        label: "Verso original",
        content: { lines: [{ text: "Letra inventada", chords: [{ symbol: "G", position: 0 }] }] },
      },
    ],
  },
  warnings: [{ code: "KEY_GUESSED", message: "Tom inferido dos acordes." }],
  stats: { sections: 1, lyricLines: 1, chords: 1, linesIgnored: 0 },
};

afterEach(cleanup);

function renderWorkflow(
  overrides: Partial<React.ComponentProps<typeof ImportWorkflow>> = {},
) {
  return render(
    <ImportWorkflow
      initialSongs={[SONG]}
      urlImportEnabled
      repository={new InMemoryMusicRepository([SONG])}
      requestUrlImport={vi.fn().mockResolvedValue(DRAFT)}
      onNavigate={vi.fn()}
      {...overrides}
    />,
  );
}

async function reachPasteReview() {
  fireEvent.change(screen.getByLabelText("Texto da cifra"), {
    target: { value: "[Verso original]\nG\nLetra inventada" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Revisar texto" }));
  expect(await screen.findByText("Revisar importação")).toBeInTheDocument();
}

describe("ImportWorkflow", () => {
  it("sends paste and enabled URL imports to the same review state", async () => {
    const requestUrlImport = vi.fn().mockResolvedValue(DRAFT);
    const { unmount } = renderWorkflow({ requestUrlImport });

    await reachPasteReview();
    expect(screen.getByText("Texto original")).toBeInTheDocument();
    expect(screen.getByText("1 seção · 1 linha · 1 acorde")).toBeInTheDocument();
    unmount();

    renderWorkflow({ requestUrlImport });
    fireEvent.change(screen.getByLabelText("URL do Cifra Club"), {
      target: { value: DRAFT.origin.url },
    });
    fireEvent.click(screen.getByRole("button", { name: "Importar URL" }));

    expect(await screen.findByText("Revisar importação")).toBeInTheDocument();
    expect(screen.getByText("Tom inferido dos acordes.")).toBeInTheDocument();
    expect(requestUrlImport).toHaveBeenCalledWith(DRAFT.origin.url);
  });

  it("blocks empty and oversized pasted text with specific errors", () => {
    renderWorkflow();

    fireEvent.click(screen.getByRole("button", { name: "Revisar texto" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o texto da cifra.");

    fireEvent.change(screen.getByLabelText("Texto da cifra"), {
      target: { value: "a".repeat(500 * 1024 + 1) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar texto" }));
    expect(screen.getByRole("alert")).toHaveTextContent("500 KiB");
    expect(screen.queryByText("Revisar importação")).not.toBeInTheDocument();
  });

  it("does not refetch songs on every render when initial songs are omitted", async () => {
    const repository: MusicRepository = {
      listSongs: vi.fn().mockResolvedValue([]),
      findSongById: vi.fn(),
      saveSong: vi.fn(),
      listChartsBySong: vi.fn(),
      findChartById: vi.fn(),
      findChartByOriginUrl: vi.fn(),
      saveChart: vi.fn(),
      saveSongAndChart: vi.fn(),
    };

    renderWorkflow({ repository, initialSongs: undefined });

    await waitFor(() => expect(repository.listSongs).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(repository.listSongs).toHaveBeenCalledTimes(1);
  });

  it("accepts pasted text at exactly the 500 KiB UTF-8 boundary", async () => {
    renderWorkflow();

    fireEvent.change(screen.getByLabelText("Texto da cifra"), {
      target: { value: "a".repeat(500 * 1024) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar texto" }));

    expect(await screen.findByText("Revisar importação")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps save disabled until a song is selected and records the selected key", async () => {
    const repository = new InMemoryMusicRepository([SONG]);
    const onNavigate = vi.fn();
    renderWorkflow({ repository, onNavigate });
    await reachPasteReview();

    const save = screen.getByRole("button", { name: "Salvar cifra" });
    const keySelect = screen.getByLabelText("Tom da música");
    expect(save).toBeDisabled();
    expect(keySelect).toHaveValue("G");
    expect(screen.getByLabelText("Vincular Canção Teste")).not.toBeChecked();

    fireEvent.change(keySelect, { target: { value: "A" } });
    fireEvent.click(screen.getByLabelText("Vincular Canção Teste"));
    expect(save).toBeEnabled();
    expect(screen.getByLabelText("Vincular Canção Teste")).toBeChecked();
    fireEvent.click(save);
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith(`/songs/${SONG.id}`));

    await expect(repository.findSongById(SONG.id)).resolves.toMatchObject({ defaultKey: "A" });
  });

  it("saves a changed section type while preserving its original label", async () => {
    const repository = new InMemoryMusicRepository([SONG]);
    const onNavigate = vi.fn();
    renderWorkflow({ repository, onNavigate });
    await reachPasteReview();

    fireEvent.change(screen.getByLabelText("Tipo de Verso original"), {
      target: { value: "chorus" },
    });

    expect(screen.getByLabelText("Tipo de Verso original")).toHaveValue("chorus");
    expect(screen.getByText("Tipo: Refrão")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Verso original" })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Vincular Canção Teste"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar cifra" }));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith(`/songs/${SONG.id}`));

    const [savedChart] = await repository.listChartsBySong(SONG.id);
    expect(savedChart.sections[0]).toMatchObject({
      type: "chorus",
      label: "Verso original",
    });
  });

  it("suggests title or artist matches, excludes unrelated songs and selects none", async () => {
    renderWorkflow({
      repository: new InMemoryMusicRepository([TITLE_MATCH, ARTIST_MATCH, UNRELATED_SONG]),
    });
    fireEvent.change(screen.getByLabelText("URL do Cifra Club"), {
      target: { value: DRAFT.origin.url },
    });
    fireEvent.click(screen.getByRole("button", { name: "Importar URL" }));
    await screen.findByText("Revisar importação");

    expect(screen.getByLabelText("Vincular Canção Teste")).not.toBeChecked();
    expect(screen.getByLabelText("Vincular Outro título")).not.toBeChecked();
    expect(screen.queryByLabelText("Vincular Sem relação")).not.toBeInTheDocument();
  });

  it("creates and persists a new song from the review UI", async () => {
    const repository = new InMemoryMusicRepository();
    const onNavigate = vi.fn();
    renderWorkflow({ repository, initialSongs: [], onNavigate });
    await reachPasteReview();

    fireEvent.change(screen.getByLabelText("Nova música"), {
      target: { value: "Nova música local" },
    });
    fireEvent.change(screen.getByLabelText("Artista"), {
      target: { value: "Artista local" },
    });
    fireEvent.change(screen.getByLabelText("Tom da música"), {
      target: { value: "A" },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Esta nova música será criada ao salvar: Nova música local · Artista local",
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar cifra" }));

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith(
      expect.stringMatching(/^\/songs\/song-local-/),
    ));
    const [savedSong] = await repository.listSongs();
    expect(savedSong).toMatchObject({
      title: "Nova música local",
      artist: "Artista local",
      defaultKey: "A",
    });
    const [savedChart] = await repository.listChartsBySong(savedSong.id);
    expect(savedChart.key).toBe("G");
  });

  it("persists the complete origin from a URL draft", async () => {
    const repository = new InMemoryMusicRepository([SONG]);
    const onNavigate = vi.fn();
    renderWorkflow({ repository, onNavigate });
    fireEvent.change(screen.getByLabelText("URL do Cifra Club"), {
      target: { value: DRAFT.origin.url },
    });
    fireEvent.click(screen.getByRole("button", { name: "Importar URL" }));
    await screen.findByText("Revisar importação");

    fireEvent.click(screen.getByLabelText("Vincular Canção Teste"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar cifra" }));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith(`/songs/${SONG.id}`));

    const [savedChart] = await repository.listChartsBySong(SONG.id);
    expect(savedChart.origin).toEqual(DRAFT.origin);
  });

  it("opens a saved URL without calling the external import route", async () => {
    const existingChart: ChordChart = {
      ...DRAFT.chart,
      id: "chart-local-existing",
      songId: SONG.id,
    };
    const requestUrlImport = vi.fn();
    const onNavigate = vi.fn();
    renderWorkflow({
      repository: new InMemoryMusicRepository([SONG], [existingChart]),
      requestUrlImport,
      onNavigate,
    });

    fireEvent.change(screen.getByLabelText("URL do Cifra Club"), {
      target: { value: DRAFT.origin.url },
    });
    fireEvent.click(screen.getByRole("button", { name: "Importar URL" }));

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith(`/songs/${SONG.id}`));
    expect(requestUrlImport).not.toHaveBeenCalled();
  });

  it("offers paste fallback after a source failure", async () => {
    renderWorkflow({
      requestUrlImport: vi.fn().mockRejectedValue(new Error("Fonte bloqueada.")),
    });

    fireEvent.change(screen.getByLabelText("URL do Cifra Club"), {
      target: { value: DRAFT.origin.url },
    });
    fireEvent.click(screen.getByRole("button", { name: "Importar URL" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Fonte bloqueada.");
    expect(screen.getByLabelText("Texto da cifra")).toBeInTheDocument();
  });

  it("keeps Principal selected when the song already has another version", async () => {
    const existing: ChordChart = {
      ...DRAFT.chart,
      id: "chart-simple",
      songId: SONG.id,
      versionLabel: "Simplificada",
    };
    renderWorkflow({
      repository: new InMemoryMusicRepository([SONG], [existing]),
    });
    await reachPasteReview();

    expect(screen.getByRole("button", { name: "Principal" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByLabelText("Vincular Canção Teste"));
    expect(await screen.findByRole("button", { name: "Simplificada" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Principal" })).toHaveAttribute("aria-pressed", "true");
  });

  it("saves a custom version tag chosen on the save step", async () => {
    const repository = new InMemoryMusicRepository([SONG]);
    const onNavigate = vi.fn();
    renderWorkflow({ repository, onNavigate });
    await reachPasteReview();

    fireEvent.change(screen.getByRole("textbox", { name: "Adicionar versão" }), {
      target: { value: "Ensaio de domingo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(screen.getByRole("button", { name: "Ensaio de domingo" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByLabelText("Vincular Canção Teste"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar cifra" }));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith(`/songs/${SONG.id}`));

    const [savedChart] = await repository.listChartsBySong(SONG.id);
    expect(savedChart.versionLabel).toBe("Ensaio de domingo");
  });

  it("keeps the reviewed draft visible when storage fails", async () => {
    const repository = new InMemoryMusicRepository([SONG]);
    repository.setFailure(new Error("storage unavailable"));
    const onNavigate = vi.fn();
    renderWorkflow({ repository, onNavigate });
    await reachPasteReview();

    fireEvent.click(screen.getByLabelText("Vincular Canção Teste"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar cifra" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Nada foi salvo");
    expect(screen.getByText("Revisar importação")).toBeInTheDocument();
    expect(screen.getByText("Letra inventada")).toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
