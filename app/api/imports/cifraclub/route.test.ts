import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const fetchCifraClubChartMock = vi.hoisted(() => vi.fn());
const getCurrentActorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/import/sources/cifraclub", () => ({
  fetchCifraClubChart: (...args: unknown[]) => fetchCifraClubChartMock(...args),
}));

vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActor: getCurrentActorMock,
}));

import { testUserActor } from "@/lib/auth/test-actor";
import { createPreviewSlotQueue } from "@/lib/import-access/preview-slot-queue";
import { resetImportModuleConfigForTests } from "@/lib/import-access/import-module-config";
import { setImportLogWriterForTests } from "@/lib/import-access/import-log";
import { ImportSourceError } from "@/lib/import/sources/cifraclub-parse";
import type { RawChart } from "@/types/import";

import { POST, createCifraClubPostHandler } from "./route";

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

function request(body: unknown, cookie?: string): Request {
  return new Request("http://localhost/api/imports/cifraclub", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie: `videira_import_session=${cookie}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function allowedHandler(fetchChart = vi.fn()): ReturnType<typeof createCifraClubPostHandler> {
  return createCifraClubPostHandler({
    canImport: async () => "allowed" as const,
    fetchChart,
    previewSlots: createPreviewSlotQueue(),
  });
}

describe("POST /api/imports/cifraclub", () => {
  it("returns 404 before parsing the request or accessing the source when disabled", async () => {
    const json = vi.fn(async () => {
      throw new Error("must not parse");
    });
    const fetchChart = vi.fn();
    const handler = createCifraClubPostHandler({
      canImport: async () => "disabled" as const,
      fetchChart,
      previewSlots: createPreviewSlotQueue(),
    });

    const response = await handler({ json } as unknown as Request);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "Recurso não encontrado." },
    });
    expect(json).not.toHaveBeenCalled();
    expect(fetchChart).not.toHaveBeenCalled();
  });

  it("returns 401 IMPORT_LOCKED without parsing when locked", async () => {
    const fetchChart = vi.fn();
    const handler = createCifraClubPostHandler({
      canImport: async () => "locked" as const,
      fetchChart,
      previewSlots: createPreviewSlotQueue(),
    });

    const response = await handler(request({ url: URL }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "IMPORT_LOCKED", message: "Import bloqueado." },
    });
    expect(fetchChart).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON without accessing the source", async () => {
    const fetchChart = vi.fn();
    const handler = allowedHandler(fetchChart);
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
      const handler = allowedHandler(fetchChart);

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
    const handler = allowedHandler(fetchChart);

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
    const handler = allowedHandler(fetchChart);

    const response = await handler(request({ url: URL }));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({
      error: { code, message },
    });
  });

  it("returns an ImportDraft containing origin, metadata and marked chord signals", async () => {
    const fetchChart = vi.fn().mockResolvedValue(RAW_CHART);
    const handler = allowedHandler(fetchChart);

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

  it("returns 429 IMPORT_BUSY when the preview queue is full", async () => {
    const fetchChart = vi.fn().mockImplementation(
      () => new Promise(() => {
        /* never resolves */
      }),
    );
    const slots = createPreviewSlotQueue(1);
    const handler = createCifraClubPostHandler({
      canImport: async () => "allowed" as const,
      fetchChart,
      previewSlots: slots,
    });

    void handler(request({ url: URL }));
    const response = await handler(request({ url: URL }));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: { code: "IMPORT_BUSY", message: "Import ocupado. Tente novamente." },
    });
  });
});

describe("exported POST", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    fetchCifraClubChartMock.mockReset();
    resetImportModuleConfigForTests();
    setImportLogWriterForTests(undefined);
  });

  it.each([
    ["unset", undefined],
    ["false", "false"],
    ["TRUE", "TRUE"],
  ] as const)(
    "returns 404 without calling the source when VIDEIRA_ENABLE_IMPORT is %s",
    async (_label, value) => {
      if (value === undefined) {
        vi.unstubAllEnvs();
        delete process.env.VIDEIRA_ENABLE_IMPORT;
      } else {
        vi.stubEnv("VIDEIRA_ENABLE_IMPORT", value);
      }
      const response = await POST(request({ url: URL }));

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        error: { code: "NOT_FOUND", message: "Recurso não encontrado." },
      });
      expect(fetchCifraClubChartMock).not.toHaveBeenCalled();
    },
  );

  it("returns 404 when only the legacy flag is enabled", async () => {
    vi.stubEnv("VIDEIRA_ENABLE_CIFRACLUB_IMPORT", "true");

    const response = await POST(request({ url: URL }));

    expect(response.status).toBe(404);
    expect(fetchCifraClubChartMock).not.toHaveBeenCalled();
  });

  it("returns 401 without a session when the module is configured", async () => {
    vi.stubEnv("VIDEIRA_ENABLE_IMPORT", "true");
    getCurrentActorMock.mockResolvedValue({ kind: "anonymous" });

    const response = await POST(request({ url: URL }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "IMPORT_LOCKED", message: "Import bloqueado." },
    });
    expect(fetchCifraClubChartMock).not.toHaveBeenCalled();
  });

  it("returns 401 for musician without import permission", async () => {
    vi.stubEnv("VIDEIRA_ENABLE_IMPORT", "true");
    getCurrentActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-musician",
        organizationId: "org-default",
        roles: ["musician"],
        teams: [],
      }),
    );

    const response = await POST(request({ url: URL }));

    expect(response.status).toBe(401);
    expect(fetchCifraClubChartMock).not.toHaveBeenCalled();
  });

  it("processes supported URLs when the module is configured and the user may import", async () => {
    vi.stubEnv("VIDEIRA_ENABLE_IMPORT", "true");
    getCurrentActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-leader",
        organizationId: "org-default",
        roles: ["worship_leader"],
        teams: [],
      }),
    );
    setImportLogWriterForTests({ write: async () => undefined });
    fetchCifraClubChartMock.mockResolvedValue(RAW_CHART);

    const response = await POST(request({ url: URL }));
    const draft = await response.json();

    expect(response.status).toBe(200);
    expect(fetchCifraClubChartMock).toHaveBeenCalledWith(URL);
    expect(draft).toMatchObject({
      origin: RAW_CHART.origin,
      rawText: RAW_CHART.text,
      song: { title: "Canção sintética", artist: "Artista sintético" },
    });
  });
});
