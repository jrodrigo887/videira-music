import { describe, expect, it } from "vitest";

import type { ImportDraft } from "@/types/import";
import type { ChordChart } from "@/types/music";

import { applyEditedChart } from "./apply-edited-chart";

const EXISTING: ChordChart = {
  id: "chart-1",
  songId: "song-1",
  title: "Título gravado",
  format: "lyrics",
  key: "G",
  timeSignature: "6/8",
  tempo: 92,
  source: "[Verso]\nG\nLetra",
  origin: {
    kind: "url",
    url: "https://www.cifraclub.com.br/artista/cancao/",
    sourceName: "Cifra Club",
  },
  sections: [
    {
      id: "section-1",
      type: "verse",
      label: "Verso",
      content: { lines: [{ text: "Letra", chords: [{ symbol: "G", position: 0 }] }] },
    },
  ],
};

const PARSED: ImportDraft = {
  id: "draft-1",
  origin: EXISTING.origin!,
  rawText: "[Refrão]\nC\nNova letra",
  song: { title: "Outro", defaultKey: "C" },
  chart: {
    format: "lyrics",
    key: "C",
    timeSignature: "4/4",
    source: "[Refrão]\nC\nNova letra",
    sections: [
      {
        id: "section-1",
        type: "chorus",
        label: "Refrão",
        content: { lines: [{ text: "Nova letra", chords: [{ symbol: "C", position: 0 }] }] },
      },
    ],
  },
  warnings: [],
  stats: { sections: 1, lyricLines: 1, chords: 1, linesIgnored: 0 },
};

describe("applyEditedChart", () => {
  it("keeps identity and metadata when only types change", () => {
    const result = applyEditedChart({
      existing: EXISTING,
      key: "A",
      sectionTypes: { "section-1": "chorus" },
    });

    expect(result.id).toBe(EXISTING.id);
    expect(result.songId).toBe(EXISTING.songId);
    expect(result.origin).toEqual(EXISTING.origin);
    expect(result.title).toBe(EXISTING.title);
    expect(result.timeSignature).toBe("6/8");
    expect(result.tempo).toBe(92);
    expect(result.source).toBe(EXISTING.source);
    expect(result.sections[0].type).toBe("chorus");
    expect(result.sections[0].label).toBe("Verso");
  });

  it("omits capo when not provided", () => {
    const withCapo = { ...EXISTING, capo: 2 };
    const result = applyEditedChart({
      existing: withCapo,
      key: "G",
      sectionTypes: {},
    });

    expect(result.capo).toBeUndefined();
  });

  it("applies parsed sections and source while keeping time signature from existing", () => {
    const result = applyEditedChart({
      existing: EXISTING,
      key: "C",
      capo: 1,
      sectionTypes: { "section-1": "bridge" },
      parsed: PARSED,
    });

    expect(result.source).toBe(PARSED.rawText);
    expect(result.timeSignature).toBe("6/8");
    expect(result.sections[0].type).toBe("bridge");
    expect(result.sections[0].label).toBe("Refrão");
    expect(result.capo).toBe(1);
  });

  it("stores capo only when greater than zero", () => {
    const result = applyEditedChart({
      existing: EXISTING,
      key: "G",
      capo: 0,
      sectionTypes: {},
    });

    expect(result.capo).toBeUndefined();
  });
});
