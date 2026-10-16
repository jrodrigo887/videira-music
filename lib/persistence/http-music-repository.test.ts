import { describe, expect, it, vi } from "vitest";

import { HttpMusicRepository } from "./http-music-repository";

describe("HttpMusicRepository.findChartById", () => {
  it("returns undefined without calling fetch", async () => {
    const fetch = vi.fn();
    const repository = new HttpMusicRepository({ fetch });

    await expect(repository.findChartById("chart-1")).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});
