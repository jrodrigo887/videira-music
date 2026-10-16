import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ChordChart } from "@/types/music";

import { chartOriginGateKind } from "./chart-origin-gate";

const URL = "https://www.cifraclub.com.br/artista/cancao/";
const URL_WITH_HASH = "https://www.cifraclub.com.br/artista/cancao/#chart";

const EXISTING: ChordChart = {
  id: "chart-1",
  songId: "song-1",
  format: "lyrics",
  key: "G",
  timeSignature: "4/4",
  sections: [],
  origin: {
    kind: "url",
    url: URL,
    sourceName: "Cifra Club",
  },
};

function bodyWithOrigin(url: string) {
  return {
    id: "chart-1",
    songId: "song-1",
    format: "lyrics",
    key: "G",
    timeSignature: "4/4",
    sections: [],
    origin: { kind: "url", url, sourceName: "Cifra Club" },
  };
}

describe("chartOriginGateKind", () => {
  it("allows the same canonical origin URL even when the hash differs", () => {
    expect(chartOriginGateKind(EXISTING, bodyWithOrigin(URL_WITH_HASH))).toBe("allow");
  });

  it("requires import for a new chart with origin", () => {
    expect(chartOriginGateKind(undefined, bodyWithOrigin(URL))).toBe("import");
  });

  it("allows a new chart without origin", () => {
    expect(
      chartOriginGateKind(undefined, {
        id: "chart-new",
        songId: "song-1",
        format: "lyrics",
        key: "G",
        timeSignature: "4/4",
        sections: [],
      }),
    ).toBe("allow");
  });

  it("requires import when the origin URL changes or is removed", () => {
    expect(
      chartOriginGateKind(
        EXISTING,
        bodyWithOrigin("https://www.cifraclub.com.br/outra/cancao/"),
      ),
    ).toBe("import");

    expect(
      chartOriginGateKind(EXISTING, {
        id: "chart-1",
        songId: "song-1",
        format: "lyrics",
        key: "G",
        timeSignature: "4/4",
        sections: [],
      }),
    ).toBe("import");
  });
});
