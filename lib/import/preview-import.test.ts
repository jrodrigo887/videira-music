import { describe, expect, it } from "vitest";

import { previewImport } from "./preview-import";

const SOURCE_WITH_WARNINGS = `[Momento livre]
G   D

E|---0---|

[Refrão]
Am   C
Uma letra inventada`;

describe("previewImport", () => {
  it("orchestrates normalization, classification, assembly and key detection", () => {
    const origin = {
      kind: "url" as const,
      url: "https://www.cifraclub.com.br/artista/musica/",
      sourceName: "Cifra Club",
    };

    const draft = previewImport({
      text: SOURCE_WITH_WARNINGS,
      origin,
      hints: { title: "Canção de teste", artist: "Artista local" },
    });

    expect(draft).toMatchObject({
      id: expect.any(String),
      origin,
      rawText: SOURCE_WITH_WARNINGS,
      song: {
        title: "Canção de teste",
        artist: "Artista local",
        defaultKey: "G",
      },
      chart: {
        title: "Canção de teste",
        format: "lyrics",
        key: "G",
        timeSignature: "4/4",
        source: SOURCE_WITH_WARNINGS,
        origin,
      },
      stats: {
        sections: 2,
        lyricLines: 2,
        chords: 4,
        linesIgnored: 1,
      },
    });

    expect(draft.chart.sections.map(({ type, label }) => [type, label])).toEqual([
      ["verse", "Momento livre"],
      ["chorus", "Refrão"],
    ]);
    expect(draft.warnings.map(({ code, line }) => [code, line])).toEqual([
      ["UNKNOWN_SECTION", 1],
      ["ORPHAN_CHORD_LINE", 2],
      ["TAB_REMOVED", 4],
      ["KEY_GUESSED", undefined],
    ]);
  });

  it("returns an empty draft with the documented warning when the input is blank", () => {
    const draft = previewImport({ text: " \n\t" });

    expect(draft).toMatchObject({
      origin: { kind: "paste" },
      rawText: " \n\t",
      song: {},
      chart: {
        format: "lyrics",
        key: "C",
        timeSignature: "4/4",
        sections: [],
        source: " \n\t",
        origin: { kind: "paste" },
      },
      warnings: [{ code: "EMPTY_INPUT", message: expect.any(String) }],
      stats: { sections: 0, lyricLines: 0, chords: 0, linesIgnored: 0 },
    });
  });

  it("applies user and directive metadata without guessing the key", () => {
    const draft = previewImport({
      text: "{key: Em}\n{capo: 2}\n[Verso]\nA\nLetra local",
      hints: { key: "G" },
    });

    expect(draft.song.defaultKey).toBe("G");
    expect(draft.chart).toMatchObject({ key: "G", capo: 2 });
    expect(draft.warnings).toEqual([]);
    expect(draft.stats).toEqual({ sections: 1, lyricLines: 1, chords: 1, linesIgnored: 2 });
  });

  it("uses marked chord tokens instead of heuristic chord classification", () => {
    const draft = previewImport({
      text: "[Verso]\nC G\nAm F\nLetra inventada",
      chordTokens: ["Am", "F"],
    });

    expect(draft.stats).toEqual({ sections: 1, lyricLines: 2, chords: 2, linesIgnored: 0 });
    expect(draft.chart.sections[0].content).toMatchObject({
      lines: [
        { text: "C G", chords: [] },
        {
          text: "Letra inventada",
          chords: [
            { symbol: "Am", position: 0 },
            { symbol: "F", position: 3 },
          ],
        },
      ],
    });
  });

  it("populates draft metadata without treating the page key as a trusted hint", () => {
    const draft = previewImport({
      text: "[Verso]\nTexto inventado",
      meta: {
        title: "Canção da página",
        artist: "Artista da página",
        key: "D",
        capo: 2,
      },
    });

    expect(draft.song).toEqual({
      title: "Canção da página",
      artist: "Artista da página",
      defaultKey: "D",
    });
    expect(draft.chart).toMatchObject({ title: "Canção da página", key: "D", capo: 2 });
    expect(draft.warnings).toEqual([]);
  });

  it("prefers the chord-derived key and warns when page metadata disagrees", () => {
    const draft = previewImport({
      text: "[Verso]\nAm F\nLetra inventada",
      meta: { key: "C", keyLabel: "C maior" },
      chordTokens: ["Am", "F"],
    });

    expect(draft.song.defaultKey).toBe("Am");
    expect(draft.chart.key).toBe("Am");
    expect(draft.warnings).toEqual([
      {
        code: "KEY_MISMATCH",
        message: expect.stringContaining("C maior"),
      },
    ]);
  });
});
