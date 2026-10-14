// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ChordChart } from "@/types/music";

import { ChordChartPreview } from "./chord-chart-preview";

const CHART: ChordChart = {
  id: "chart-1",
  songId: "song-1",
  format: "lyrics",
  key: "G",
  timeSignature: "4/4",
  sections: [
    {
      id: "verse-1",
      type: "verse",
      label: "Verso",
      content: {
        lines: [
          {
            text: "Minha oração só é real transformação se começar em mim",
            chords: [
              { symbol: "Am7", position: 0 },
              { symbol: "G", position: 18 },
              { symbol: "C9", position: 37 },
            ],
          },
        ],
      },
    },
  ],
};

afterEach(cleanup);

describe("ChordChartPreview", () => {
  it("keeps each chord attached to its lyric segment without horizontal scrolling", () => {
    const { container } = render(
      <ChordChartPreview chart={CHART} showDiagrams={false} />,
    );

    const musicLine = container.querySelector(".music-line");
    const segments = Array.from(container.querySelectorAll(".music-segment"));

    expect(musicLine).not.toHaveClass("overflow-x-auto");
    expect(segments).toHaveLength(3);
    expect(segments.map((segment) => segment.querySelector(".music-chords")?.textContent))
      .toEqual(["Am7", "G", "C9"]);
    expect(segments.map((segment) => segment.querySelector(".music-lyrics")?.textContent))
      .toEqual(["Minha oração só é ", "real transformação ", "se começar em mim"]);
  });
});
