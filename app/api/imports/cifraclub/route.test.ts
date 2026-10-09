import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ImportSourceError } from "@/lib/import/sources/cifraclub-parse";
import type { RawChart } from "@/types/import";

import { createCifraClubPostHandler } from "./route";

const URL = "https://www.cifraclub.com.br/artista/cancao/";
const RAW_CHART: RawChart = {
  text: "[Verso]\nD   A\nLetra inventada",
  chordTokens: ["D", "A"],
  meta: {
    title: "Canção sintética",
    artist: "Artista sintético",
    key: "D",
    capo: 2,
  },
  origin: {
    kind: "url",
    url: URL,
    sourceName: "Cifra Club",
    fetchedAt: "2026-10-09T18:00:00.000Z",
  },
};

function request(body: unknown): Request {
  return new Request("http://localhost/api/imports/cifraclub", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/imports/cifraclub", () => {
  it("returns 404 before parsing the request or accessing the source when disabled", async () => {
    const json = vi.fn(async () => {
      throw new Error("must not parse");
    });
    const fetchChart = vi.fn();
    const handler = createCifraClubPostHandler({ enabled: () => false, fetchChart });

    const response = await handler({ json } as unknown as Request);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "Recurso não encontrado." },
    });
    expect(json).not.toHaveBeenCalled();
    expect(fetchChart).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON without accessing the source", async () => {
    const fetchChart = vi.fn();
    const handler = createCifraClubPostHandler({ enabled: () => true, fetchChart });
    const malformed = new Request("http://localhost/api/imports/cifraclub", {
      method: "POST",
      body: "{",
    });

    const response = await handler(malformed);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: "INVALID_REQUEST", message: "Envie um JSON válido com o campo url." },
    });
    expect(fetchChart).not.toHaveBeenCalled();
  });

  it.each([{}, { url: "" }, { url: 42 }])(
    "returns 400 when the URL field is missing or invalid",
    async (body) => {
      const fetchChart = vi.fn();
      const handler = createCifraClubPostHandler({ enabled: () => true, fetchChart });

      const response = await handler(request(body));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: { code: "INVALID_REQUEST", message: "Envie um JSON válido com o campo url." },
      });
      expect(fetchChart).not.toHaveBeenCalled();
    },
  );

  it("returns 422 UNSUPPORTED_SOURCE for URLs outside the allowlist", async () => {
    const fetchChart = vi.fn();
    const handler = createCifraClubPostHandler({ enabled: () => true, fetchChart });

    const response = await handler(request({ url: "https://example.com/cancao/" }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNSUPPORTED_SOURCE",
        message: "Use uma URL HTTPS do Cifra Club.",
      },
    });
    expect(fetchChart).not.toHaveBeenCalled();
  });

  it.each([
    ["SOURCE_BLOCKED", 502, "A origem bloqueou a navegação."],
    ["SOURCE_LAYOUT_CHANGED", 502, "O layout da origem mudou."],
    ["SOURCE_TIMEOUT", 504, "A origem excedeu o tempo limite."],
  ] as const)("maps %s to its documented HTTP response", async (code, status, message) => {
    const fetchChart = vi.fn().mockRejectedValue(new ImportSourceError(code, message));
    const handler = createCifraClubPostHandler({ enabled: () => true, fetchChart });

    const response = await handler(request({ url: URL }));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({
      error: { code, message },
    });
  });

  it("returns an ImportDraft containing origin, metadata and marked chord signals", async () => {
    const fetchChart = vi.fn().mockResolvedValue(RAW_CHART);
    const handler = createCifraClubPostHandler({ enabled: () => true, fetchChart });

    const response = await handler(request({ url: URL }));
    const draft = await response.json();

    expect(response.status).toBe(200);
    expect(fetchChart).toHaveBeenCalledWith(URL);
    expect(draft).toMatchObject({
      origin: RAW_CHART.origin,
      rawText: RAW_CHART.text,
      song: {
        title: "Canção sintética",
        artist: "Artista sintético",
        defaultKey: "D",
      },
      chart: {
        title: "Canção sintética",
        key: "D",
        capo: 2,
        origin: RAW_CHART.origin,
      },
      stats: { sections: 1, lyricLines: 1, chords: 2, linesIgnored: 0 },
      warnings: [],
    });
  });
});
