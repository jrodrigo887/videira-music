import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { testUserActor } from "@/lib/auth/test-actor";
import { seedSimulatedIdentities } from "@/lib/auth/simulated-identities";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import {
  createTempDatabaseUrl,
  createTestPrismaClient,
  destroyTestPrismaClient,
} from "@/lib/persistence/test-temp-db";
import type { ChordChart } from "@/types/music";

import {
  listRevisions,
  restoreRevision,
  saveChartWithHistory,
} from "./chart-history-service";

const SONG_ID = "song-history";
const CHART_ID = "chart-history";

const BASE_CHART: ChordChart = {
  id: CHART_ID,
  songId: SONG_ID,
  format: "lyrics",
  key: "G",
  timeSignature: "4/4",
  sections: [],
  source: "v1",
};

function writer() {
  return testUserActor({
    userId: "user-leader",
    organizationId: DEFAULT_ORGANIZATION_ID,
    roles: ["worship_leader"],
    teams: [],
  });
}

function author() {
  return testUserActor({
    userId: "user-musician",
    organizationId: DEFAULT_ORGANIZATION_ID,
    roles: ["musician"],
    teams: [],
  });
}

describe("chart-history-service", () => {
  let temp!: { url: string; cleanup: () => Promise<void> };
  let prisma: PrismaClient;

  beforeAll(async () => {
    temp = await createTempDatabaseUrl();
    prisma = await createTestPrismaClient(temp.url);
    await seedSimulatedIdentities(prisma);
    await prisma.song.create({
      data: {
        id: SONG_ID,
        organizationId: DEFAULT_ORGANIZATION_ID,
        title: "Histórico",
        label: "Histórico",
        alternateKeys: [],
        meta: "",
        searchText: "historico",
        publicLyrics: false,
      },
    });
  });

  afterAll(async () => {
    await destroyTestPrismaClient(prisma);
    await temp.cleanup();
  });

  it("sets createdByUserId on create without a revision", async () => {
    const actor = writer();
    await saveChartWithHistory(prisma, actor, BASE_CHART);
    const row = await prisma.chordChart.findUnique({ where: { id: CHART_ID } });
    expect(row?.createdByUserId).toBe(actor.userId);
    expect(row?.lastEditedByUserId).toBe(actor.userId);
    const revisions = await prisma.chordChartRevision.findMany({ where: { chartId: CHART_ID } });
    expect(revisions).toHaveLength(0);
  });

  it("stores a revision with prior content on update", async () => {
    const actor = writer();
    await saveChartWithHistory(prisma, actor, { ...BASE_CHART, source: "v2", key: "A" });
    const revisions = await prisma.chordChartRevision.findMany({ where: { chartId: CHART_ID } });
    expect(revisions).toHaveLength(1);
    expect(revisions[0]?.source).toBe("v1");
    expect(revisions[0]?.key).toBe("G");
    expect(revisions[0]?.savedByUserId).toBe(actor.userId);
    const row = await prisma.chordChart.findUnique({ where: { id: CHART_ID } });
    expect(row?.source).toBe("v2");
    expect(row?.lastEditedByUserId).toBe(actor.userId);
  });

  it("restores a revision and keeps it in the list", async () => {
    const actor = writer();
    const listed = await listRevisions(prisma, actor, CHART_ID);
    expect(listed.length).toBeGreaterThanOrEqual(1);
    const target = listed[listed.length - 1]!;
    const restored = await restoreRevision(prisma, actor, CHART_ID, target.id);
    expect(restored.source).toBe("v1");
    const after = await listRevisions(prisma, actor, CHART_ID);
    expect(after.some((entry) => entry.id === target.id)).toBe(true);
    expect(after.length).toBeGreaterThan(listed.length);
  });

  it("lets the chart author save without music:write", async () => {
    const chartId = "chart-author";
    await prisma.chordChart.create({
      data: {
        id: chartId,
        organizationId: DEFAULT_ORGANIZATION_ID,
        songId: SONG_ID,
        format: "lyrics",
        key: "G",
        timeSignature: "4/4",
        sections: [],
        source: "autor",
        createdByUserId: "user-musician",
        lastEditedByUserId: "user-leader",
      },
    });
    await saveChartWithHistory(prisma, author(), {
      ...BASE_CHART,
      id: chartId,
      source: "autor v2",
    });
    const row = await prisma.chordChart.findUnique({ where: { id: chartId } });
    expect(row?.source).toBe("autor v2");
    expect(row?.lastEditedByUserId).toBe("user-musician");
  });
});
