import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { testUserActor } from "@/lib/auth/test-actor";
import { seedSimulatedIdentities } from "@/lib/auth/simulated-identities";
import {
  CHART_SOURCE_TOO_LARGE_MESSAGE,
  EMPTY_CHART_SOURCE_MESSAGE,
} from "@/lib/charts/chart-source-limits";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import {
  createTempDatabaseUrl,
  createTestPrismaClient,
  destroyTestPrismaClient,
} from "@/lib/persistence/test-temp-db";

import {
  approveSuggestion,
  isChartSuggestionServiceError,
  listPendingSuggestions,
  rejectSuggestion,
  submitSuggestion,
} from "./chart-suggestion-service";

const SONG_ID = "song-suggest";
const CHART_ID = "chart-suggest";

const SOURCE_V1 = "[Verso]\nG\nLinha um";
const SOURCE_V2 = "[Verso]\nA\nLinha dois";

function musician() {
  return testUserActor({
    userId: "user-musician",
    organizationId: DEFAULT_ORGANIZATION_ID,
    roles: ["musician"],
    teams: [],
  });
}

function leader() {
  return testUserActor({
    userId: "user-leader",
    organizationId: DEFAULT_ORGANIZATION_ID,
    roles: ["worship_leader"],
    teams: [],
  });
}

describe("chart-suggestion-service", () => {
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
        title: "Sugestão",
        label: "Sugestão",
        alternateKeys: [],
        meta: "",
        searchText: "sugestao",
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
        source: "original",
        createdByUserId: "user-leader",
        lastEditedByUserId: "user-leader",
      },
    });
  });

  afterAll(async () => {
    await destroyTestPrismaClient(prisma);
    await temp.cleanup();
  });

  it("creates a pending suggestion on first submit", async () => {
    const result = await submitSuggestion(prisma, musician(), CHART_ID, { source: SOURCE_V1 });
    expect(result.status).toBe("created");
    const row = await prisma.chartSuggestion.findFirst({
      where: { chartId: CHART_ID, authorUserId: "user-musician" },
    });
    expect(row?.status).toBe("pending");
    expect(row?.source).toBe(SOURCE_V1);
  });

  it("replaces the pending suggestion on second submit", async () => {
    const result = await submitSuggestion(prisma, musician(), CHART_ID, { source: SOURCE_V2 });
    expect(result.status).toBe("replaced");
    const rows = await prisma.chartSuggestion.findMany({
      where: { chartId: CHART_ID, authorUserId: "user-musician", status: "pending" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBe(SOURCE_V2);
  });

  it("rejects empty source", async () => {
    await expect(
      submitSuggestion(prisma, musician(), CHART_ID, { source: "   " }),
    ).rejects.toMatchObject({
      status: 400,
      userMessage: EMPTY_CHART_SOURCE_MESSAGE,
    });
  });

  it("rejects source above 500 KiB", async () => {
    const huge = "x".repeat(500 * 1024 + 1);
    await expect(submitSuggestion(prisma, musician(), CHART_ID, { source: huge })).rejects.toMatchObject({
      status: 400,
      userMessage: CHART_SOURCE_TOO_LARGE_MESSAGE,
    });
  });

  it("does not change the live chart on submit", async () => {
    const before = await prisma.chordChart.findUnique({ where: { id: CHART_ID } });
    await submitSuggestion(prisma, musician(), CHART_ID, { source: SOURCE_V2 });
    const after = await prisma.chordChart.findUnique({ where: { id: CHART_ID } });
    expect(after?.source).toBe(before?.source);
    expect(after?.key).toBe(before?.key);
    expect(after?.capo).toBe(before?.capo);
  });

  it("approves with history and marks reviewed", async () => {
    const pending = await prisma.chartSuggestion.findFirst({
      where: { chartId: CHART_ID, status: "pending" },
    });
    expect(pending).toBeTruthy();
    await approveSuggestion(prisma, leader(), pending!.id);
    const chart = await prisma.chordChart.findUnique({ where: { id: CHART_ID } });
    expect(chart?.source).toBe(SOURCE_V2);
    const revisions = await prisma.chordChartRevision.findMany({ where: { chartId: CHART_ID } });
    expect(revisions.length).toBeGreaterThanOrEqual(1);
    const approved = await prisma.chartSuggestion.findUnique({ where: { id: pending!.id } });
    expect(approved?.status).toBe("approved");
    expect(approved?.reviewedByUserId).toBe("user-leader");
    expect(approved?.reviewedAt).toBeTruthy();
  });

  it("rejects without changing the chart", async () => {
    await submitSuggestion(prisma, musician(), CHART_ID, { source: SOURCE_V1 });
    const pending = await prisma.chartSuggestion.findFirst({
      where: { chartId: CHART_ID, status: "pending" },
    });
    const liveBefore = await prisma.chordChart.findUnique({ where: { id: CHART_ID } });
    await rejectSuggestion(prisma, leader(), pending!.id);
    const liveAfter = await prisma.chordChart.findUnique({ where: { id: CHART_ID } });
    expect(liveAfter?.source).toBe(liveBefore?.source);
    const rejected = await prisma.chartSuggestion.findUnique({ where: { id: pending!.id } });
    expect(rejected?.status).toBe("rejected");
  });

  it("returns SUGGESTION_NOT_PENDING on second approve", async () => {
    await submitSuggestion(prisma, musician(), CHART_ID, { source: SOURCE_V1 });
    const pending = await prisma.chartSuggestion.findFirst({
      where: { chartId: CHART_ID, status: "pending" },
    });
    await approveSuggestion(prisma, leader(), pending!.id);
    await expect(approveSuggestion(prisma, leader(), pending!.id)).rejects.toMatchObject({
      code: "SUGGESTION_NOT_PENDING",
      status: 409,
    });
  });

  it("forbids review without music:write", async () => {
    await submitSuggestion(prisma, musician(), CHART_ID, { source: SOURCE_V1 });
    const pending = await prisma.chartSuggestion.findFirst({
      where: { chartId: CHART_ID, status: "pending" },
    });
    await expect(approveSuggestion(prisma, musician(), pending!.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
    await expect(rejectSuggestion(prisma, musician(), pending!.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });

  it("returns NOT_FOUND for trashed song", async () => {
    const trashedSong = "song-trashed";
    const trashedChart = "chart-trashed";
    await prisma.song.create({
      data: {
        id: trashedSong,
        organizationId: DEFAULT_ORGANIZATION_ID,
        title: "Lixeira",
        label: "Lixeira",
        alternateKeys: [],
        meta: "",
        searchText: "lixeira",
        publicLyrics: false,
        deletedAt: new Date(),
      },
    });
    await prisma.chordChart.create({
      data: {
        id: trashedChart,
        organizationId: DEFAULT_ORGANIZATION_ID,
        songId: trashedSong,
        format: "lyrics",
        key: "G",
        timeSignature: "4/4",
        sections: [],
        source: "x",
      },
    });
    await expect(
      submitSuggestion(prisma, musician(), trashedChart, { source: SOURCE_V1 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("lists pending suggestions for reviewers", async () => {
    await submitSuggestion(prisma, musician(), CHART_ID, { source: SOURCE_V1 });
    const list = await listPendingSuggestions(prisma, leader(), CHART_ID);
    expect(list.some((entry) => entry.authorUserId === "user-musician")).toBe(true);
  });

  it("maps service errors", () => {
    expect(isChartSuggestionServiceError(new Error("x"))).toBe(false);
  });
});
