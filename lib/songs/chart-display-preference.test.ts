import { describe, expect, it } from "vitest";

import {
  DEFAULT_CHART_DISPLAY,
  chartDisplayStyle,
  normalizeChartDisplay,
  readChartDisplay,
  stepChartSetting,
  writeChartDisplay,
  type ChartDisplayStorage,
} from "./chart-display-preference";

function memoryStorage(): ChartDisplayStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe("chart display preference", () => {
  it("returns defaults when nothing is stored or the payload is corrupt", () => {
    const storage = memoryStorage();
    expect(readChartDisplay(storage)).toEqual(DEFAULT_CHART_DISPLAY);

    storage.setItem("videira-music:chart-display", "{not json");
    expect(readChartDisplay(storage)).toEqual(DEFAULT_CHART_DISPLAY);
  });

  it("round-trips custom settings and drops the key when back to defaults", () => {
    const storage = memoryStorage();
    const custom = { ...DEFAULT_CHART_DISPLAY, fontSize: 18, chordColor: "#FF6600" };

    writeChartDisplay(custom, storage);
    expect(readChartDisplay(storage)).toEqual({ ...custom, chordColor: "#ff6600" });

    writeChartDisplay(DEFAULT_CHART_DISPLAY, storage);
    expect(storage.data.size).toBe(0);
  });

  it("clamps out-of-range values and ignores invalid fields", () => {
    expect(
      normalizeChartDisplay({
        fontFamily: "comic",
        fontSize: 99,
        lineHeight: 0.2,
        lineGap: "big",
        lyricsColor: "red",
      }),
    ).toEqual({ ...DEFAULT_CHART_DISPLAY, fontSize: 28, lineHeight: 1 });
  });

  it("steps decimal settings without floating point drift and respects limits", () => {
    let settings = DEFAULT_CHART_DISPLAY;
    settings = stepChartSetting(settings, "lineHeight", 1);
    settings = stepChartSetting(settings, "lineHeight", 1);
    expect(settings.lineHeight).toBe(1.8);

    expect(stepChartSetting({ ...settings, lineGap: 0 }, "lineGap", -1).lineGap).toBe(0);
  });

  it("maps settings to css custom properties", () => {
    expect(chartDisplayStyle({ ...DEFAULT_CHART_DISPLAY, lyricsColor: "#112233" })).toMatchObject({
      "--chart-font-size": "14px",
      "--chart-line-height": "1.6",
      "--chart-line-gap": "0px",
      "--chart-lyrics-color": "#112233",
    });
  });
});
