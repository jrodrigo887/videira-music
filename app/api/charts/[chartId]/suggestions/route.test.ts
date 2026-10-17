import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getCurrentActorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-actor", () => ({
  getCurrentActor: getCurrentActorMock,
}));

import { testUserActor } from "@/lib/auth/test-actor";
import { seedSimulatedIdentities } from "@/lib/auth/simulated-identities";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import { resetPrismaClientForTests } from "@/lib/persistence/prisma-client";
import {
  createTempDatabaseUrl,
  createTestPrismaClient,
  destroyTestPrismaClient,
} from "@/lib/persistence/test-temp-db";
import type { PrismaClient } from "@prisma/client";

import { GET, POST } from "./route";

const CHART_ID = "chart-suggest-route";
const SONG_ID = "song-suggest-route";
const SOURCE = "[Verso]\nG\nTexto";

describe("chart suggestions routes", () => {
  let temp!: { url: string; cleanup: () => Promise<void> };
  let prisma: PrismaClient;

  beforeAll(async () => {
    temp = await createTempDatabaseUrl();
    process.env.DATABASE_URL = temp.url;
    prisma = await createTestPrismaClient(temp.url);
    await seedSimulatedIdentities(prisma);
    await prisma.song.create({
      data: {
        id: SONG_ID,
        organizationId: DEFAULT_ORGANIZATION_ID,
        title: "Rota",
        label: "Rota",
        alternateKeys: [],
        meta: "",
        searchText: "rota",
        publicLyrics: false,
      },
    });
    await prisma.chordChart.create({
      data: {
        id: CHART_ID,
        organizationId: DEFAULT_ORGANIZATION_ID,
        songId: SONG_ID,
        format: "lyrics",
        key: "G",
        timeSignature: "4/4",
        sections: [],
        source: "live",
      },
    });
  });

  afterAll(async () => {
    await destroyTestPrismaClient(prisma);
    resetPrismaClientForTests();
    delete process.env.DATABASE_URL;
    await temp.cleanup();
  });

  it("returns 401 without session on POST", async () => {
    getCurrentActorMock.mockResolvedValue({ kind: "anonymous" });
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: SOURCE }),
      }),
      { params: Promise.resolve({ chartId: CHART_ID }) },
    );
    expect(response.status).toBe(401);
  });

  it("returns 201 then 200 for the same author", async () => {
    getCurrentActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-musician",
        organizationId: DEFAULT_ORGANIZATION_ID,
        roles: ["musician"],
        teams: [],
      }),
    );
    const first = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: SOURCE }),
      }),
      { params: Promise.resolve({ chartId: CHART_ID }) },
    );
    expect(first.status).toBe(201);

    const second = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "[Verso]\nA\nOutro" }),
      }),
      { params: Promise.resolve({ chartId: CHART_ID }) },
    );
    expect(second.status).toBe(200);
  });

  it("returns 403 when approving without music:write", async () => {
    const pending = await prisma.chartSuggestion.findFirst({
      where: { chartId: CHART_ID, status: "pending" },
    });
    getCurrentActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-musician",
        organizationId: DEFAULT_ORGANIZATION_ID,
        roles: ["musician"],
        teams: [],
      }),
    );
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approve", suggestionId: pending?.id }),
      }),
      { params: Promise.resolve({ chartId: CHART_ID }) },
    );
    expect(response.status).toBe(403);
  });

  it("lists pending suggestions for reviewers", async () => {
    getCurrentActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-leader",
        organizationId: DEFAULT_ORGANIZATION_ID,
        roles: ["worship_leader"],
        teams: [],
      }),
    );
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ chartId: CHART_ID }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { suggestions: unknown[] };
    expect(body.suggestions.length).toBeGreaterThanOrEqual(1);
  });
});
