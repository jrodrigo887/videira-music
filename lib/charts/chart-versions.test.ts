import { describe, expect, it } from "vitest";

import { originalChart, songVersionTags } from "./chart-versions";

describe("song versions", () => {
  it("selects the original chart as Principal even when another version is listed first", () => {
    const charts = [
      { id: "custom", versionLabel: "Ensaio" },
      { id: "original", versionLabel: null },
      { id: "lyrics", versionLabel: "Letra" },
    ];

    expect(originalChart(charts)?.id).toBe("original");
    expect(songVersionTags(charts)).toEqual([
      { chartId: "original", label: "Principal" },
      { chartId: "lyrics", label: "Letra" },
      { chartId: "custom", label: "Ensaio" },
    ]);
  });

  it("treats the only chart as the original Principal tag", () => {
    const charts = [{ id: "only", versionLabel: "simplificada" }];

    expect(originalChart(charts)?.id).toBe("only");
    expect(songVersionTags(charts)).toEqual([{ chartId: "only", label: "Principal" }]);
  });
});
