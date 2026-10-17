import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const canImportMock = vi.hoisted(() => vi.fn());
const getCurrentActorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/import-access/import-access-policy", () => ({
  canImport: (...args: unknown[]) => canImportMock(...args),
}));

vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActor: getCurrentActorMock,
}));

import { testUserActor } from "@/lib/auth/test-actor";
import { resetImportModuleConfigForTests } from "@/lib/import-access/import-module-config";
import { setImportLogWriterForTests } from "@/lib/import-access/import-log";
import { InMemoryMusicRepository } from "@/lib/persistence/music-repository";
import type { ChordChart, Song } from "@/types/music";

import { createChartPutHandler, PUT } from "./route";

const ORG = "org-default";
const URL = "https://www.cifraclub.com.br/artista/cancao/";

const SONG: Song = {
  id: "song-put",
  title: "Canção",
  label: "Canção",
  defaultKey: "G",
  alternateKeys: [],
  meta: "",
};

const CHART: ChordChart = {
  id: "chart-put",
  songId: SONG.id,
  format: "lyrics",
  key: "G",
  timeSignature: "4/4",
  source: "[Verso]\nG\nLetra",
  sections: [
    {
      id: "section-1",
      type: "verse",
      label: "Verso",
      content: { lines: [{ text: "Letra", chords: [{ symbol: "G", position: 0 }] }] },
    },
  ],
  origin: {
    kind: "url",
    url: URL,
    sourceName: "Cifra Club",
  },
};

function chartBody(overrides: Partial<ChordChart> = {}): ChordChart {
  return { ...CHART, ...overrides };
}

function putRequest(chart: ChordChart): Request {
  return new Request(`http://localhost/api/charts/${chart.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(chart),
  });
}

function handlerWith(
  repository: InMemoryMusicRepository,
  options: {
    actor?: ReturnType<typeof testUserActor>;
    canEdit?: boolean;
  } = {},
) {
  const actor =
    options.actor ??
    testUserActor({
      userId: "user-manager",
      organizationId: ORG,
      roles: ["manager"],
      teams: [],
    });
  return createChartPutHandler({
    isConfigured: () => true,
    getRepository: async () => repository,
    getActor: async () => actor,
    preflightChartWrite: async () => undefined,
    persistChart: async (_actor, chart) => {
      await repository.saveChart(chart);
    },
  });
}

describe("PUT /api/charts/[chartId] handler", () => {
  const importLogWrites: unknown[] = [];

  beforeEach(() => {
    importLogWrites.length = 0;
    delete process.env.VIDEIRA_ENABLE_IMPORT;
    setImportLogWriterForTests({
      write: async (entry) => {
        importLogWrites.push(entry);
      },
    });
    canImportMock.mockResolvedValue("locked");
  });

  afterEach(() => {
    setImportLogWriterForTests(undefined);
    resetImportModuleConfigForTests();
    delete process.env.VIDEIRA_ENABLE_IMPORT;
    vi.clearAllMocks();
  });

  it("returns 204 for same-origin update without import access and writes no ImportLog", async () => {
    const repository = new InMemoryMusicRepository([SONG], [CHART]);
    const handler = handlerWith(repository);
    const updated = chartBody({
      source: "[Verso]\nA\nLetra nova",
      sections: [
        {
          id: "section-1",
          type: "verse",
          label: "Verso",
          content: { lines: [{ text: "Letra nova", chords: [{ symbol: "A", position: 0 }] }] },
        },
      ],
    });

    const response = await handler(putRequest(updated), {
      params: Promise.resolve({ chartId: CHART.id }),
    });

    expect(response.status).toBe(204);
    expect(importLogWrites).toEqual([]);
    const saved = await repository.findChartById(CHART.id);
    expect(saved?.source).toBe(updated.source);
    expect(saved?.id).toBe(CHART.id);
    expect(saved?.songId).toBe(SONG.id);
    expect(saved?.origin?.url).toBe(URL);
  });

  it("returns 422 when the key is outside the closed tonality list", async () => {
    const repository = new InMemoryMusicRepository([SONG], [CHART]);
    const handler = handlerWith(repository);

    const response = await handler(putRequest(chartBody({ key: "C7" })), {
      params: Promise.resolve({ chartId: CHART.id }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_FAILED" },
    });
  });

  it("returns 422 when songId changes on an existing chart", async () => {
    const repository = new InMemoryMusicRepository([SONG], [CHART]);
    const handler = handlerWith(repository);

    const response = await handler(putRequest(chartBody({ songId: "other-song" })), {
      params: Promise.resolve({ chartId: CHART.id }),
    });

    expect(response.status).toBe(422);
  });

  it("returns 404 when origin changes and import is disabled", async () => {
    canImportMock.mockResolvedValue("disabled");
    const repository = new InMemoryMusicRepository([SONG], [CHART]);
    const handler = handlerWith(repository);
    const next = chartBody({
      origin: {
        kind: "url",
        url: "https://www.cifraclub.com.br/outra/cancao/",
        sourceName: "Cifra Club",
      },
    });

    const response = await handler(putRequest(next), {
      params: Promise.resolve({ chartId: CHART.id }),
    });

    expect(response.status).toBe(404);
    await expect(repository.findChartById(CHART.id)).resolves.toEqual(CHART);
  });

  it("returns 401 IMPORT_LOCKED when origin changes and import is locked", async () => {
    process.env.VIDEIRA_ENABLE_IMPORT = "true";
    const repository = new InMemoryMusicRepository([SONG], [CHART]);
    const handler = handlerWith(repository);
    const next = chartBody({
      origin: {
        kind: "url",
        url: "https://www.cifraclub.com.br/outra/cancao/",
        sourceName: "Cifra Club",
      },
    });

    const response = await handler(putRequest(next), {
      params: Promise.resolve({ chartId: CHART.id }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "IMPORT_LOCKED" },
    });
  });

  it("returns 422 for invalid chart bodies", async () => {
    const repository = new InMemoryMusicRepository([SONG], [CHART]);
    const handler = handlerWith(repository);
    const request = new Request(`http://localhost/api/charts/${CHART.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: CHART.id }),
    });

    const response = await handler(request, { params: Promise.resolve({ chartId: CHART.id }) });
    expect(response.status).toBe(422);
  });

  it("does not log chart source text on persistence errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const repository = new InMemoryMusicRepository([SONG], [CHART]);
    repository.setFailure(new Error("db down"));
    const handler = handlerWith(repository);

    const response = await handler(putRequest(chartBody()), {
      params: Promise.resolve({ chartId: CHART.id }),
    });

    expect(response.status).toBe(500);
    const logged = consoleSpy.mock.calls.map((call) => JSON.stringify(call)).join("\n");
    expect(logged).not.toContain("Letra");
    consoleSpy.mockRestore();
  });
});

describe("PUT /api/charts/[chartId] auth", () => {
  it("returns 401 without an authenticated user", async () => {
    getCurrentActorMock.mockResolvedValue({ kind: "anonymous" });

    const response = await PUT(
      putRequest(chartBody()),
      { params: Promise.resolve({ chartId: CHART.id }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("returns 403 without music:write when the actor cannot edit the chart", async () => {
    getCurrentActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-musician",
        organizationId: ORG,
        roles: ["musician"],
        teams: [],
      }),
    );

    const repository = new InMemoryMusicRepository([SONG], [CHART]);
    const handler = createChartPutHandler({
      isConfigured: () => true,
      getRepository: async () => repository,
      getActor: async () =>
        testUserActor({
          userId: "user-musician",
          organizationId: ORG,
          roles: ["musician"],
          teams: [],
        }),
      preflightChartWrite: async () =>
        new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
      persistChart: async (_actor, chart) => {
        await repository.saveChart(chart);
      },
    });

    const response = await handler(putRequest(chartBody()), {
      params: Promise.resolve({ chartId: CHART.id }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: "FORBIDDEN" },
    });
  });

  it("returns 204 for the chart author without music:write", async () => {
    const authorChart = { ...CHART, createdByUserId: "user-musician" };
    const repository = new InMemoryMusicRepository([SONG], [authorChart]);
    const handler = handlerWith(repository, {
      actor: testUserActor({
        userId: "user-musician",
        organizationId: ORG,
        roles: ["musician"],
        teams: [],
      }),
      canEdit: true,
    });

    const response = await handler(putRequest(chartBody({ source: "autor" })), {
      params: Promise.resolve({ chartId: CHART.id }),
    });

    expect(response.status).toBe(204);
  });
});
