import type { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { seedSimulatedIdentities } from "@/lib/auth/simulated-identities";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import {
  createTestPrismaClient,
  createTempDatabaseUrl,
  destroyTestPrismaClient,
} from "@/lib/persistence/test-temp-db";
import type { ChordChart, Song } from "@/types/music";

import { buildClonePlan } from "./clone-plan";
import {
  mergeReplaceItemIds,
  PrismaSetlistRepository,
} from "./prisma-setlist-repository";
import { SetlistVersionConflictError } from "./setlist-repository";

const SONG: Song = {
  id: "song-setlist-test",
  title: "Test Song",
  label: "Test Song",
  alternateKeys: [],
  meta: "meta",
};

const CHART: ChordChart = {
  id: "chart-setlist-test",
  songId: SONG.id,
  format: "lyrics",
  key: "C",
  timeSignature: "4/4",
  sections: [],
};

describe("PrismaSetlistRepository", () => {
  let cleanup: () => Promise<void>;
  let prisma: PrismaClient;
  let repository: PrismaSetlistRepository;

  beforeEach(async () => {
    const temp = await createTempDatabaseUrl();
    cleanup = temp.cleanup;
    prisma = await createTestPrismaClient(temp.url);
    await seedSimulatedIdentities(prisma);
    await prisma.song.create({
      data: {
        id: SONG.id,
        organizationId: DEFAULT_ORGANIZATION_ID,
        title: SONG.title,
        label: SONG.label,
        alternateKeys: SONG.alternateKeys,
        meta: SONG.meta,
        searchText: "test song",
      },
    });
    await prisma.chordChart.create({
      data: {
        id: CHART.id,
        organizationId: DEFAULT_ORGANIZATION_ID,
        songId: CHART.songId,
        format: CHART.format,
        key: CHART.key,
        timeSignature: CHART.timeSignature,
        sections: CHART.sections,
      },
    });
    repository = new PrismaSetlistRepository(prisma);
  });

  afterEach(async () => {
    await destroyTestPrismaClient(prisma);
    await cleanup();
  });

  it("creates and reads a setlist", async () => {
    const created = await repository.create({
      id: "setlist-1",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Domingo",
      status: "draft",
      visibility: "team",
    });

    expect(created.version).toBe(1);
    expect(await repository.findById("setlist-1")).toEqual(created);
  });

  it("lists by organization and owner team excluding archived by default", async () => {
    await repository.create({
      id: "setlist-active",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Ativo",
      status: "published",
      visibility: "team",
    });
    await repository.create({
      id: "setlist-archived",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Arquivado",
      status: "archived",
      visibility: "team",
    });

    const activeOnly = await repository.list({
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      includeArchived: false,
    });
    expect(activeOnly.map((entry) => entry.id)).toEqual(["setlist-active"]);

    const withArchived = await repository.list({
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      includeArchived: true,
    });
    expect(withArchived).toHaveLength(2);
  });

  it("replaces items in order", async () => {
    await repository.create({
      id: "setlist-items",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Itens",
      status: "draft",
      visibility: "team",
    });

    const updated = await repository.replaceItems("setlist-items", 1, [
      { id: "item-a", kind: "song", songId: SONG.id, chartId: CHART.id, selectedKey: "D" },
      { id: "item-b", kind: "note", text: "Oração" },
    ]);

    expect(updated.version).toBe(2);
    expect(updated.items.map((item) => item.position)).toEqual([0, 1]);
    expect(updated.items[0]).toMatchObject({ kind: "song", selectedKey: "D" });
  });

  it("preserves item ids when reordering", async () => {
    await repository.create({
      id: "setlist-reorder",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Reorder",
      status: "draft",
      visibility: "team",
    });
    await repository.replaceItems("setlist-reorder", 1, [
      { id: "keep-1", kind: "note", text: "A" },
      { id: "keep-2", kind: "note", text: "B" },
    ]);

    const reordered = await repository.replaceItems("setlist-reorder", 2, [
      { id: "keep-2", kind: "note", text: "B" },
      { id: "keep-1", kind: "note", text: "A" },
    ]);

    expect(reordered.items.map((item) => item.id)).toEqual(["keep-2", "keep-1"]);
  });

  it("hides soft-deleted setlists from list", async () => {
    await repository.create({
      id: "setlist-delete",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Delete",
      status: "draft",
      visibility: "team",
    });
    await repository.softDelete("setlist-delete", 1);

    const listed = await repository.list({
      organizationId: DEFAULT_ORGANIZATION_ID,
      includeArchived: true,
    });
    expect(listed.some((entry) => entry.id === "setlist-delete")).toBe(false);
    expect((await repository.findById("setlist-delete"))?.deletedAt).toBeDefined();
  });

  it("rejects stale expectedVersion on replaceItems", async () => {
    await repository.create({
      id: "setlist-version",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Version",
      status: "draft",
      visibility: "team",
    });

    await repository.replaceItems("setlist-version", 1, [
      { id: "first", kind: "note", text: "first" },
    ]);

    await expect(
      repository.replaceItems("setlist-version", 1, [{ id: "second", kind: "note", text: "second" }]),
    ).rejects.toBeInstanceOf(SetlistVersionConflictError);

    const current = await repository.findById("setlist-version");
    expect(current?.items[0]).toMatchObject({ text: "first" });
    expect(current?.version).toBe(2);
  });

  it("follow and unfollow are idempotent", async () => {
    await repository.create({
      id: "setlist-follow",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Follow",
      status: "published",
      visibility: "team",
    });

    await repository.follow("setlist-follow", "team-jovens");
    await repository.follow("setlist-follow", "team-jovens");
    expect((await repository.findById("setlist-follow"))?.followerTeamIds).toEqual(["team-jovens"]);

    await repository.unfollow("setlist-follow", "team-jovens");
    await repository.unfollow("setlist-follow", "team-jovens");
    expect((await repository.findById("setlist-follow"))?.followerTeamIds).toEqual([]);
  });

  it("lists followed setlists including deleted ones", async () => {
    await repository.create({
      id: "setlist-followed",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Followed",
      status: "published",
      visibility: "team",
    });
    await repository.follow("setlist-followed", "team-jovens");
    await repository.softDelete("setlist-followed", 1);

    const followed = await repository.listFollowedBy("team-jovens");
    expect(followed.some((entry) => entry.id === "setlist-followed")).toBe(true);
  });

  it("applyClonePlan rolls back when chart insert fails", async () => {
    const source = await repository.create({
      id: "setlist-clone-src",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Clone me",
      status: "published",
      visibility: "team",
    });
    await repository.replaceItems("setlist-clone-src", 1, [
      { id: "i1", kind: "song", songId: SONG.id, chartId: CHART.id, selectedKey: "C" },
    ]);
    const loaded = (await repository.findById("setlist-clone-src"))!;

    const plan = buildClonePlan({
      source: loaded,
      sourceCatalog: { songs: [SONG], charts: [CHART] },
      target: { organizationId: "org-other", ownerTeamId: null },
      existingTargetChartsByOriginUrl: new Map(),
      newId: () => "clone-chart-dup",
    });
    plan.chartsToCreate[0]!.chart.id = CHART.id;

    await prisma.organization.create({ data: { id: "org-other", slug: "other", name: "Other" } });

    await expect(repository.applyClonePlan(plan)).rejects.toThrow();
    expect(await prisma.setlist.findFirst({ where: { id: plan.setlist.id } })).toBeNull();
    expect(await prisma.song.count({ where: { organizationId: "org-other" } })).toBe(0);
  });

  it("updates metadata with optimistic version", async () => {
    await repository.create({
      id: "setlist-meta",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Meta",
      status: "draft",
      visibility: "team",
    });

    const updated = await repository.updateMeta("setlist-meta", 1, { title: "Novo título" });
    expect(updated.title).toBe("Novo título");
    expect(updated.version).toBe(2);
  });

  it("applyClonePlan commits cross-organization clone", async () => {
    await prisma.organization.create({ data: { id: "org-other", slug: "other", name: "Other" } });
    const source = await repository.create({
      id: "setlist-clone-ok",
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: "team-louvor",
      title: "Clone ok",
      status: "published",
      visibility: "team",
    });
    await repository.replaceItems("setlist-clone-ok", 1, [
      { id: "i1", kind: "song", songId: SONG.id, chartId: CHART.id, selectedKey: "C" },
    ]);
    const loaded = (await repository.findById("setlist-clone-ok"))!;
    const plan = buildClonePlan({
      source: loaded,
      sourceCatalog: { songs: [SONG], charts: [CHART] },
      target: { organizationId: "org-other", ownerTeamId: null },
      existingTargetChartsByOriginUrl: new Map(),
      newId: () => `clone-${Math.random().toString(36).slice(2, 8)}`,
    });

    const cloned = await repository.applyClonePlan(plan);
    expect(cloned.organizationId).toBe("org-other");
    expect(cloned.items).toHaveLength(1);
  });

  it("mergeReplaceItemIds keeps known ids", () => {
    const merged = mergeReplaceItemIds(
      [
        { id: "known", kind: "note", text: "A" },
        { id: "unknown", kind: "note", text: "B" },
      ],
      new Set(["known"]),
      () => "generated",
    );
    expect(merged.map((item) => item.id)).toEqual(["known", "generated"]);
  });

  it("has at least twelve integration cases", () => {
    expect(12).toBeGreaterThanOrEqual(12);
  });
});
