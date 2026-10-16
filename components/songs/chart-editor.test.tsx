// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InMemoryMusicRepository } from "@/lib/persistence/music-repository";
import { RepositoryError } from "@/lib/persistence/repository-error";
import type { ChordChart } from "@/types/music";

import { ChartEditor } from "./chart-editor";

const previewImportMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/import/preview-import", async () => {
  const actual = await vi.importActual<typeof import("@/lib/import/preview-import")>(
    "@/lib/import/preview-import",
  );
  return {
    previewImport: (input: Parameters<typeof actual.previewImport>[0]) => {
      if (previewImportMock.getMockImplementation()) {
        return previewImportMock(input);
      }
      return actual.previewImport(input);
    },
  };
});

const CHART: ChordChart = {
  id: "chart-edit-1",
  songId: "song-1",
  format: "lyrics",
  key: "G",
  timeSignature: "4/4",
  source: "[Verso]\nG\nLetra salva",
  sections: [
    {
      id: "section-1",
      type: "verse",
      label: "Verso",
      content: { lines: [{ text: "Letra salva", chords: [{ symbol: "G", position: 0 }] }] },
    },
  ],
  origin: {
    kind: "url",
    url: "https://www.cifraclub.com.br/artista/cancao/",
    sourceName: "Cifra Club",
  },
};

afterEach(() => {
  cleanup();
  previewImportMock.mockReset();
});

describe("ChartEditor", () => {
  it("shows stored source, key, capo, and section labels without parsing on first render", () => {
    const repository = new InMemoryMusicRepository();
    render(
      <ChartEditor
        chart={{ ...CHART, capo: 2 }}
        repository={repository}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Texto da cifra")).toHaveValue("[Verso]\nG\nLetra salva");
    expect(screen.getByLabelText("Tom da cifra")).toHaveValue("G");
    expect(screen.getByDisplayValue("2")).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo de Verso")).toHaveValue("verse");
    expect(previewImportMock).not.toHaveBeenCalled();
  });

  it("reprocesses text changes and keeps key and capo controls", () => {
    previewImportMock.mockImplementation(() => ({
      id: "draft",
      origin: CHART.origin,
      rawText: "[Refrão]\nC\nNova",
      song: { title: "x", defaultKey: "C" },
      chart: {
        format: "lyrics",
        key: "C",
        timeSignature: "4/4",
        sections: [
          {
            id: "section-2",
            type: "chorus",
            label: "Refrão",
            content: { lines: [{ text: "Nova", chords: [{ symbol: "C", position: 0 }] }] },
          },
        ],
      },
      warnings: [],
      stats: { sections: 1, lyricLines: 1, chords: 1, linesIgnored: 0 },
    }));

    const repository = new InMemoryMusicRepository();
    render(
      <ChartEditor
        chart={{ ...CHART, capo: 2 }}
        repository={repository}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("2"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Texto da cifra"), {
      target: { value: "[Refrão]\nC\nNova" },
    });

    expect(previewImportMock).toHaveBeenCalledWith({
      text: "[Refrão]\nC\nNova",
      origin: CHART.origin,
    });
    expect(screen.getByLabelText("Tom da cifra")).toHaveValue("G");
    expect(screen.getByDisplayValue("3")).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo de Refrão")).toHaveValue("chorus");
  });

  it("blocks empty text and oversized text from saving", async () => {
    const saveChart = vi.fn();
    const repository = new InMemoryMusicRepository();
    repository.saveChart = saveChart;

    render(
      <ChartEditor chart={CHART} repository={repository} onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText("Texto da cifra"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar cifra" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o texto da cifra.");
    expect(saveChart).not.toHaveBeenCalled();

    const textarea = screen.getByRole("textbox", { name: /texto da cifra/i });
    const huge = "x".repeat(500 * 1024 + 1);
    fireEvent.change(textarea, { target: { value: huge } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar cifra" }));
    expect(screen.getByRole("alert")).toHaveTextContent("O texto deve ter no máximo 500 KiB.");
    expect(saveChart).not.toHaveBeenCalled();
  });

  it("lists parser warnings and keeps the draft when save fails", async () => {
    previewImportMock.mockImplementation(() => ({
      id: "draft",
      origin: CHART.origin,
      rawText: "[Verso]\nG\nOutra",
      song: { title: "x", defaultKey: "G" },
      chart: {
        format: "lyrics",
        key: "G",
        timeSignature: "4/4",
        sections: CHART.sections,
      },
      warnings: [{ code: "KEY_GUESSED", message: "Tom inferido." }],
      stats: { sections: 1, lyricLines: 1, chords: 1, linesIgnored: 0 },
    }));

    const repository = new InMemoryMusicRepository();
    repository.saveChart = vi.fn().mockRejectedValue(new RepositoryError("PERSISTENCE_FAILED", "x"));
    const onSaved = vi.fn();

    render(
      <ChartEditor chart={CHART} repository={repository} onSaved={onSaved} onCancel={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText("Texto da cifra"), {
      target: { value: "[Verso]\nG\nOutra" },
    });
    expect(screen.getByText("Tom inferido.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Salvar cifra" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Nada foi salvo. Revise os dados e tente novamente.",
      );
    });
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Texto da cifra")).toHaveValue("[Verso]\nG\nOutra");
  });

  it("saves with the same chart id and edited source on success", async () => {
    const repository = new InMemoryMusicRepository();
    const onSaved = vi.fn();

    render(
      <ChartEditor chart={CHART} repository={repository} onSaved={onSaved} onCancel={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText("Texto da cifra"), {
      target: { value: "[Verso]\nG\nLetra ajustada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar cifra" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const saved = await repository.findChartById(CHART.id);
    expect(saved?.id).toBe(CHART.id);
    expect(saved?.source).toBe("[Verso]\nG\nLetra ajustada");
  });
});
