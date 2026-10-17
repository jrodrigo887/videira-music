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

const CHART_ID = "chart-revisions-route";
const SONG_ID = "song-revisions-route";

describe("chart revisions routes", () => {
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
        title: "Revisões",
        label: "Revisões",
        alternateKeys: [],
        meta: "",
        searchText: "revisoes",
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
        createdByUserId: "user-leader",
        lastEditedByUserId: "user-leader",
      },
    });
    await prisma.chordChartRevision.create({
      data: {
        chartId: CHART_ID,
        source: "old",
        sections: [],
        key: "G",
        savedByUserId: "user-leader",
        savedAt: new Date("2026-10-01T12:00:00.000Z"),
      },
    });
  });

  afterAll(async () => {
    await destroyTestPrismaClient(prisma);
    resetPrismaClientForTests();
    delete process.env.DATABASE_URL;
    await temp.cleanup();
  });

  it("lists revisions newest first for editors", async () => {
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
    const body = (await response.json()) as { revisions: Array<{ savedAt: string }> };
    expect(body.revisions.length).toBeGreaterThanOrEqual(1);
    expect(body.revisions[0]?.savedAt).toBeDefined();
  });

  it("returns 403 for musicians who cannot edit", async () => {
    getCurrentActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-musician",
        organizationId: DEFAULT_ORGANIZATION_ID,
        roles: ["musician"],
        teams: [],
      }),
    );

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ chartId: CHART_ID }),
    });

    expect(response.status).toBe(403);
  });

  it("restores a revision for editors", async () => {
    getCurrentActorMock.mockResolvedValue(
      testUserActor({
        userId: "user-leader",
        organizationId: DEFAULT_ORGANIZATION_ID,
        roles: ["worship_leader"],
        teams: [],
      }),
    );
    const listed = await prisma.chordChartRevision.findMany({
      where: { chartId: CHART_ID },
      orderBy: { savedAt: "desc" },
    });
    const revisionId = listed[0]!.id;

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ revisionId }),
      }),
      { params: Promise.resolve({ chartId: CHART_ID }) },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { chart: { source?: string } };
    expect(body.chart.source).toBe("old");
  });
});
