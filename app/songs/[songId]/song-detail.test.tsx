// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = "";
  readonly thresholds: readonly number[] = [];

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

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
    source: "[Verso]\nG\nLetra inventada",
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
  vi.restoreAllMocks();
});

function mockSetlistApi(items: Array<Record<string, unknown>>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/setlists/sl-nav")) {
        return new Response(JSON.stringify({ setlist: { id: "sl-nav", items } }), { status: 200 });
      }
      if (url.includes("/api/setlists/missing")) {
        return new Response(JSON.stringify({ error: { code: "SETLIST_NOT_FOUND" } }), { status: 404 });
      }
      return new Response("{}", { status: 404 });
    }),
  );
}

const songItem = (id: string, songId: string, title: string) => ({
  id,
  kind: "song",
  position: 0,
  songId,
  chartId: "chart-1",
  selectedKey: "G",
  song: { title },
  chart: { key: "G", imported: false },
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
    expect(screen.getByText("Cifras importadas")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);

    const chordLine = document.querySelector(".music-chords");
    expect(chordLine).toHaveTextContent("G");
    fireEvent.click(screen.getByRole("button", { name: "Aumentar meio-tom" }));
    expect(chordLine).toHaveTextContent("G#");
  });

  it("adjusts and persists chart text settings from the resources sidebar", async () => {
    const chart = persistedChart(SEED_SONG.id);
    render(
      <SongDetail
        songId={SEED_SONG.id}
        repository={new InMemoryMusicRepository([SEED_SONG], [chart])}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Música Seed" })).toBeInTheDocument();
    const chartBody = document.querySelector<HTMLElement>(".music-chart");
    expect(chartBody?.style.getPropertyValue("--chart-font-size")).toBe("14px");

    fireEvent.click(screen.getAllByRole("button", { name: /Texto/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Aumentar tamanho" }));
    fireEvent.click(screen.getByRole("button", { name: "Serifa" }));

    expect(chartBody?.style.getPropertyValue("--chart-font-size")).toBe("15px");
    expect(chartBody?.style.getPropertyValue("--chart-font-family")).toContain("serif");
    expect(JSON.parse(localStorage.getItem("videira-music:chart-display") ?? "{}")).toMatchObject({
      fontSize: 15,
      fontFamily: "serif",
    });

    fireEvent.click(screen.getByRole("button", { name: "Restaurar padrão" }));
    expect(chartBody?.style.getPropertyValue("--chart-font-size")).toBe("14px");
    expect(localStorage.getItem("videira-music:chart-display")).toBeNull();
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
    expect(document.querySelector(".music-chords")).toHaveTextContent("G");
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

  it("shows next link for middle songs in setlist context", async () => {
    mockSetlistApi([
      songItem("item-1", SEED_SONG.id, "Música Seed"),
      { id: "note-1", kind: "note", position: 1, text: "Pausa" },
      songItem("item-2", "song-2", "Próxima"),
    ]);
    const chart = persistedChart(SEED_SONG.id);
    render(
      <SongDetail
        songId={SEED_SONG.id}
        setlistContext={{ setlistId: "sl-nav", setlistItemId: "item-1", selectedKey: "G" }}
        repository={new InMemoryMusicRepository([SEED_SONG], [chart])}
      />,
    );
    expect(await screen.findByRole("link", { name: "Próxima" })).toHaveAttribute(
      "href",
      "/songs/song-2?setlist=sl-nav&item=item-2&key=G",
    );
    expect(screen.queryByRole("link", { name: "Anterior" })).not.toBeInTheDocument();
  });

  it("shows previous link for later songs in setlist context", async () => {
    mockSetlistApi([
      songItem("item-1", SEED_SONG.id, "Música Seed"),
      songItem("item-2", "song-2", "Outra"),
    ]);
    const chart = persistedChart("song-2");
    render(
      <SongDetail
        songId="song-2"
        setlistContext={{ setlistId: "sl-nav", setlistItemId: "item-2", selectedKey: "G" }}
        repository={
          new InMemoryMusicRepository(
            [{ ...SEED_SONG, id: "song-2", title: "Outra", label: "Outra" }],
            [chart],
          )
        }
      />,
    );
    expect(await screen.findByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      `/songs/${SEED_SONG.id}?setlist=sl-nav&item=item-1&key=G`,
    );
    expect(screen.queryByRole("link", { name: "Próxima" })).not.toBeInTheDocument();
  });

  it("skips note items when linking to neighbors", async () => {
    mockSetlistApi([
      songItem("item-1", SEED_SONG.id, "Música Seed"),
      { id: "note-1", kind: "note", position: 1, text: "Transição" },
      songItem("item-3", "song-3", "Depois"),
    ]);
    const chart = persistedChart(SEED_SONG.id);
    render(
      <SongDetail
        songId={SEED_SONG.id}
        setlistContext={{ setlistId: "sl-nav", setlistItemId: "item-1" }}
        repository={new InMemoryMusicRepository([SEED_SONG], [chart])}
      />,
    );
    expect(await screen.findByRole("link", { name: "Próxima" })).toHaveAttribute(
      "href",
      "/songs/song-3?setlist=sl-nav&item=item-3&key=G",
    );
  });

  it("hides navigation for invalid setlist item context", async () => {
    mockSetlistApi([songItem("item-1", SEED_SONG.id, "Música Seed")]);
    const chart = persistedChart(SEED_SONG.id);
    render(
      <SongDetail
        songId={SEED_SONG.id}
        setlistContext={{ setlistId: "sl-nav", setlistItemId: "missing-item" }}
        repository={new InMemoryMusicRepository([SEED_SONG], [chart])}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Música Seed" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Navegação no setlist" })).not.toBeInTheDocument();
  });

  it("hides navigation when setlist api returns 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 404 })),
    );
    const chart = persistedChart(SEED_SONG.id);
    render(
      <SongDetail
        songId={SEED_SONG.id}
        setlistContext={{ setlistId: "missing", setlistItemId: "item-1" }}
        repository={new InMemoryMusicRepository([SEED_SONG], [chart])}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Música Seed" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("navigation", { name: "Navegação no setlist" })).not.toBeInTheDocument();
    });
  });

  it("points the back arrow to the setlist that opened the chart", async () => {
    const chart = persistedChart(SEED_SONG.id);
    render(
      <SongDetail
        songId={SEED_SONG.id}
        setlistContext={{ setlistId: "sl-nav", setlistItemId: "item-1" }}
        repository={new InMemoryMusicRepository([SEED_SONG], [chart])}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Música Seed" })).toBeInTheDocument();
    const backLinks = screen.getAllByRole("link", { name: "Voltar para o setlist" });
    expect(backLinks.length).toBeGreaterThan(0);
    for (const link of backLinks) {
      expect(link).toHaveAttribute("href", "/setlists/sl-nav/play");
    }
  });

  it("points the back arrow to the library when the chart was opened from there", async () => {
    const chart = persistedChart(SEED_SONG.id);
    render(
      <SongDetail
        songId={SEED_SONG.id}
        repository={new InMemoryMusicRepository([SEED_SONG], [chart])}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Música Seed" })).toBeInTheDocument();
    const backLinks = screen.getAllByRole("link", { name: "Voltar para biblioteca" });
    expect(backLinks.length).toBeGreaterThan(0);
    for (const link of backLinks) {
      expect(link).toHaveAttribute("href", "/songs");
    }
  });

  it("does not show setlist navigation without context", async () => {
    const chart = persistedChart(SEED_SONG.id);
    render(
      <SongDetail
        songId={SEED_SONG.id}
        repository={new InMemoryMusicRepository([SEED_SONG], [chart])}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Música Seed" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Navegação no setlist" })).not.toBeInTheDocument();
  });

  it("shows Editar cifra for persisted lyrics charts with source when canEditMusic is true", async () => {
    const chart = persistedChart(SEED_SONG.id);
    render(
      <SongDetail
        songId={SEED_SONG.id}
        canEditMusic
        repository={new InMemoryMusicRepository([SEED_SONG], [chart])}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Música Seed" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Editar cifra" }).length).toBeGreaterThan(0);
  });

  it("shows chart history and pending suggestions in the resources sidebar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url.includes("/revisions")) {
          return Response.json({
            revisions: [
              {
                id: "rev-1",
                savedAt: "2026-10-17T12:02:00.000Z",
                versionLabel: "simplificada",
              },
            ],
          });
        }
        if (url.includes("/suggestions")) {
          return Response.json({ suggestions: [] });
        }
        return new Response(null, { status: 404 });
      }),
    );

    const chart = { ...persistedChart(SEED_SONG.id), versionLabel: "simplificada" };
    render(
      <SongDetail
        songId={SEED_SONG.id}
        canEditMusic
        repository={new InMemoryMusicRepository([SEED_SONG], [chart])}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Música Seed" })).toBeInTheDocument();
    const aside = screen.getByRole("complementary");
    const history = within(aside).getByRole("region", { name: "Histórico da cifra" });
    expect(history.compareDocumentPosition(within(aside).getByRole("button", { name: /Texto/ }))).toBe(
      Node.DOCUMENT_POSITION_PRECEDING,
    );
    expect(within(history).getByRole("button", { name: "Principal" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await within(history).findByText("Música Seed - simplificada")).toBeInTheDocument();
    expect(within(history).getByText("Música Seed - simplificada").closest("p")).toHaveClass("text-[12px]");
    expect(within(aside).getByRole("region", { name: "Sugestões de cifra" })).toBeInTheDocument();
    expect(within(aside).getByText("Sugestões pendentes")).toBeInTheDocument();

    const article = screen.getByRole("article");
    expect(within(article).queryByRole("region", { name: "Histórico da cifra" })).not.toBeInTheDocument();
    expect(within(article).queryByText("Sugestões pendentes")).not.toBeInTheDocument();
  });

  it("hides Editar cifra without music:write or without persisted source", async () => {
    const chart = persistedChart(SEED_SONG.id);
    const withoutSource: ChordChart = { ...chart, source: undefined };
    const gridChart: ChordChart = { ...chart, id: "chart-grid", format: "grid" };

    render(
      <SongDetail
        songId={SEED_SONG.id}
        repository={new InMemoryMusicRepository([SEED_SONG], [chart])}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Música Seed" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar cifra" })).not.toBeInTheDocument();

    cleanup();
    render(
      <SongDetail
        songId={SEED_SONG.id}
        canEditMusic
        repository={new InMemoryMusicRepository([SEED_SONG], [withoutSource])}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Música Seed" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar cifra" })).not.toBeInTheDocument();

    cleanup();
    render(
      <SongDetail
        songId={SEED_SONG.id}
        canEditMusic
        repository={new InMemoryMusicRepository([SEED_SONG], [gridChart])}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Música Seed" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar cifra" })).not.toBeInTheDocument();
  });

  it("loads the selected version and keeps custom tags as selectors", async () => {
    const first = { ...persistedChart(SEED_SONG.id), versionLabel: "Principal" };
    const second: ChordChart = {
      ...persistedChart(SEED_SONG.id),
      id: "chart-second",
      versionLabel: "Ensaio",
      title: "Segunda cifra",
      source: "[Refrão]\nC\nOutra letra",
      sections: [
        {
          id: "section-2",
          type: "chorus",
          label: "Refrão",
          content: {
            lines: [{ text: "Outra letra", chords: [{ symbol: "C", position: 0 }] }],
          },
        },
      ],
    };
    render(
      <SongDetail
        songId={SEED_SONG.id}
        canEditMusic
        repository={new InMemoryMusicRepository([SEED_SONG], [first, second])}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Música Seed" })).toBeInTheDocument();
    const history = screen.getByRole("region", { name: "Histórico da cifra" });
    expect(within(history).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(history).getByRole("button", { name: "Principal" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Letra inventada")).toBeInTheDocument();
    expect(screen.queryByText("Outra letra")).not.toBeInTheDocument();

    fireEvent.click(within(history).getByRole("button", { name: "Ensaio" }));
    expect(screen.getByText("Outra letra")).toBeInTheDocument();
    expect(screen.queryByText("Letra inventada")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Editar cifra" }));
    expect(screen.getByRole("region", { name: "Editor de cifra" })).toBeInTheDocument();
  });

  it("reloads charts and closes the editor after a successful save", async () => {
    const chart = persistedChart(SEED_SONG.id);
    const repository = new InMemoryMusicRepository([SEED_SONG], [chart]);
    render(
      <SongDetail
        songId={SEED_SONG.id}
        canEditMusic
        repository={repository}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Música Seed" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Editar cifra" })[0]);
    fireEvent.change(screen.getByLabelText("Texto da cifra"), {
      target: { value: "[Verso]\nA\nLetra atualizada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar cifra" }));

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "Editor de cifra" })).not.toBeInTheDocument();
    });
    await expect(repository.findChartById(chart.id)).resolves.toMatchObject({
      source: "[Verso]\nA\nLetra atualizada",
    });
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
