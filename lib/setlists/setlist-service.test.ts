import type { PrismaClient } from "@prisma/client";

import type { SetlistSummary } from "@/types/setlist";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import {
  createTestPrismaClient,
  createTempDatabaseUrl,
  destroyTestPrismaClient,
} from "@/lib/persistence/test-temp-db";
import { SetlistError } from "@/lib/setlists/setlist-errors";
import { PrismaWorshipTeamRepository } from "@/lib/worship-teams/prisma-worship-team-repository";

import { actorFor, FIXTURE_CHART, FIXTURE_SONG, seedSetlistFixture } from "./setlist-test-fixture";
import { PrismaSetlistRepository } from "./prisma-setlist-repository";
import { createSetlistServiceFromPrisma } from "./setlist-service";

describe("SetlistService", () => {
  let cleanup: () => Promise<void>;
  let prisma: PrismaClient;
  let repository: PrismaSetlistRepository;
  let service: ReturnType<typeof createSetlistServiceFromPrisma>;
  let idCounter = 0;

  beforeEach(async () => {
    idCounter = 0;
    const temp = await createTempDatabaseUrl();
    cleanup = temp.cleanup;
    prisma = await createTestPrismaClient(temp.url);
    await seedSetlistFixture(prisma);
    repository = new PrismaSetlistRepository(prisma);
    service = createSetlistServiceFromPrisma(
      prisma,
      DEFAULT_ORGANIZATION_ID,
      new PrismaWorshipTeamRepository(prisma),
      () => `id-${++idCounter}`,
    );
  });

  afterEach(async () => {
    await destroyTestPrismaClient(prisma);
    await cleanup();
  });

  async function createPublishedTeamSetlist(id: string, teamId: string, visibility: "team" | "organization" | "public" = "team") {
    await repository.create({
      id,
      organizationId: DEFAULT_ORGANIZATION_ID,
      ownerTeamId: teamId,
      title: id,
      status: "published",
      visibility,
    });
  }

  describe("read and list", () => {
    it("returns readable setlist with permissions", async () => {
      await repository.create({
        id: "sl-read",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: "team-louvor",
        title: "Domingo",
        status: "published",
        visibility: "team",
      });
      const leader = await actorFor(prisma, "user-leader");
      const view = await service.getReadable(leader, "sl-read");
      expect(view.title).toBe("Domingo");
      expect(view.permissions.edit).toBe(true);
    });

    it("hides missing setlists as SETLIST_NOT_FOUND", async () => {
      const leader = await actorFor(prisma, "user-leader");
      await expect(service.getReadable(leader, "missing")).rejects.toMatchObject({
        code: "SETLIST_NOT_FOUND",
        status: 404,
      });
    });

    it("hides deleted setlists as SETLIST_NOT_FOUND", async () => {
      await repository.create({
        id: "sl-deleted",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: "team-louvor",
        title: "Deleted",
        status: "published",
        visibility: "team",
      });
      await repository.softDelete("sl-deleted", 1);
      const leader = await actorFor(prisma, "user-leader");
      await expect(service.getReadable(leader, "sl-deleted")).rejects.toMatchObject({
        code: "SETLIST_NOT_FOUND",
      });
    });

    it("hides unauthorized drafts as SETLIST_NOT_FOUND", async () => {
      await repository.create({
        id: "sl-draft",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: "team-louvor",
        title: "Draft",
        status: "draft",
        visibility: "team",
      });
      const musician = await actorFor(prisma, "user-musician");
      await expect(service.getReadable(musician, "sl-draft")).rejects.toMatchObject({
        code: "SETLIST_NOT_FOUND",
      });
    });

    it("lists team tab entries for owner team", async () => {
      await createPublishedTeamSetlist("sl-team", "team-louvor");
      const leader = await actorFor(prisma, "user-leader");
      const team = { id: "team-louvor", organizationId: DEFAULT_ORGANIZATION_ID, slug: "louvor", name: "Louvor" };
      const list = await service.listTab(leader, { team, tab: "team" });
      expect((list as SetlistSummary[]).map((entry) => entry.id)).toContain("sl-team");
    });

    it("lists others tab excluding current team", async () => {
      await repository.create({
        id: "sl-jovens",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: "team-jovens",
        title: "Jovens",
        status: "published",
        visibility: "organization",
      });
      const musician = await actorFor(prisma, "user-musician");
      const team = { id: "team-louvor", organizationId: DEFAULT_ORGANIZATION_ID, slug: "louvor", name: "Louvor" };
      const list = await service.listTab(musician, { team, tab: "others" });
      expect((list as SetlistSummary[]).map((entry) => entry.id)).toContain("sl-jovens");
    });

    it("lists organization-owned setlists", async () => {
      await repository.create({
        id: "sl-org",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: null,
        title: "Igreja",
        status: "published",
        visibility: "organization",
      });
      const musician = await actorFor(prisma, "user-musician");
      const list = await service.listTab(musician, { team: null, tab: "organization" });
      expect((list as SetlistSummary[]).map((entry) => entry.id)).toContain("sl-org");
    });

    it("excludes archived setlists from browse tabs", async () => {
      await repository.create({
        id: "sl-archived",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: "team-louvor",
        title: "Arquivado",
        status: "archived",
        visibility: "team",
      });
      const leader = await actorFor(prisma, "user-leader");
      const team = { id: "team-louvor", organizationId: DEFAULT_ORGANIZATION_ID, slug: "louvor", name: "Louvor" };
      const list = await service.listTab(leader, { team, tab: "team" });
      expect((list as SetlistSummary[]).map((entry) => entry.id)).not.toContain("sl-archived");
    });

    it("shows followed unavailable entries when deleted", async () => {
      await createPublishedTeamSetlist("sl-followed", "team-jovens");
      await repository.follow("sl-followed", "team-louvor");
      await repository.softDelete("sl-followed", 1);
      const leader = await actorFor(prisma, "user-leader");
      const team = { id: "team-louvor", organizationId: DEFAULT_ORGANIZATION_ID, slug: "louvor", name: "Louvor" };
      const list = await service.listTab(leader, { team, tab: "following" });
      expect(list).toEqual([{ setlistId: "sl-followed", available: false }]);
    });

    it("shows followed archived setlists as available", async () => {
      await repository.create({
        id: "sl-follow-archived",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: "team-jovens",
        title: "Arquivado seguido",
        status: "archived",
        visibility: "team",
      });
      await repository.follow("sl-follow-archived", "team-louvor");
      const leader = await actorFor(prisma, "user-leader");
      const team = { id: "team-louvor", organizationId: DEFAULT_ORGANIZATION_ID, slug: "louvor", name: "Louvor" };
      const list = await service.listTab(leader, { team, tab: "following" });
      expect(list[0]).toMatchObject({ setlistId: "sl-follow-archived", available: true });
    });

    it("excludes drafts from tabs for non-editors", async () => {
      await repository.create({
        id: "sl-hidden-draft",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: "team-jovens",
        title: "Draft",
        status: "draft",
        visibility: "team",
      });
      const musician = await actorFor(prisma, "user-musician");
      const team = { id: "team-louvor", organizationId: DEFAULT_ORGANIZATION_ID, slug: "louvor", name: "Louvor" };
      const list = await service.listTab(musician, { team, tab: "others" });
      expect((list as SetlistSummary[]).map((entry) => entry.id)).not.toContain("sl-hidden-draft");
    });

    it("denies anonymous read of organization published setlists", async () => {
      await repository.create({
        id: "sl-anon",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: null,
        title: "Public org",
        status: "published",
        visibility: "organization",
      });
      await expect(service.getReadable({ kind: "anonymous" }, "sl-anon")).rejects.toMatchObject({
        code: "SETLIST_NOT_FOUND",
      });
    });
  });

  describe("create", () => {
    it("creates team setlist with defaults", async () => {
      const leader = await actorFor(prisma, "user-leader");
      const created = await service.create(leader, {
        title: "Novo",
        ownerTeamId: "team-louvor",
      });
      expect(created.status).toBe("draft");
      expect(created.visibility).toBe("team");
      expect(created.version).toBe(1);
    });

    it("creates organization setlist for admin", async () => {
      const admin = await actorFor(prisma, "user-admin");
      const created = await service.create(admin, {
        title: "Org",
        owner: "organization",
      });
      expect(created.ownerTeamId).toBeNull();
      expect(created.visibility).toBe("organization");
    });

    it("denies create for non-leader", async () => {
      const musician = await actorFor(prisma, "user-musician");
      await expect(
        service.create(musician, { title: "Nope", ownerTeamId: "team-louvor" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects organization visibility on church setlist", async () => {
      const admin = await actorFor(prisma, "user-admin");
      await expect(
        service.create(admin, { title: "Bad", owner: "organization", visibility: "team" }),
      ).rejects.toMatchObject({ code: "INVALID_VISIBILITY" });
    });

    it("rejects create on archived team", async () => {
      const admin = await actorFor(prisma, "user-admin");
      await prisma.worshipTeam.update({
        where: { id: "team-jovens" },
        data: { archivedAt: new Date() },
      });
      await expect(
        service.create(admin, { title: "Arquivado", ownerTeamId: "team-jovens" }),
      ).rejects.toMatchObject({ code: "TEAM_ARCHIVED" });
    });

    it("allows explicit visibility on team create", async () => {
      const leader = await actorFor(prisma, "user-leader");
      const created = await service.create(leader, {
        title: "Privado",
        ownerTeamId: "team-louvor",
        visibility: "private",
      });
      expect(created.visibility).toBe("private");
    });

    it("denies organization create for leader", async () => {
      const leader = await actorFor(prisma, "user-leader");
      await expect(
        service.create(leader, { title: "Org", owner: "organization" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("stores optional metadata on create", async () => {
      const leader = await actorFor(prisma, "user-leader");
      const created = await service.create(leader, {
        title: "Meta",
        ownerTeamId: "team-louvor",
        eventType: "service",
        notes: "Notas",
      });
      expect(created.eventType).toBe("service");
      expect(created.notes).toBe("Notas");
    });

    it("denies anonymous create", async () => {
      await expect(
        service.create({ kind: "anonymous" }, { title: "Anon", ownerTeamId: "team-louvor" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("replaceItems", () => {
    beforeEach(async () => {
      await repository.create({
        id: "sl-items",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: "team-louvor",
        title: "Itens",
        status: "draft",
        visibility: "team",
      });
    });

    it("replaces song and note items", async () => {
      const leader = await actorFor(prisma, "user-leader");
      const updated = await service.replaceItems(leader, "sl-items", {
        expectedVersion: 1,
        items: [
          { kind: "song", songId: FIXTURE_SONG.id, chartId: FIXTURE_CHART.id },
          { kind: "note", text: "Oração" },
        ],
      });
      expect(updated.items).toHaveLength(2);
      expect(updated.items[0]).toMatchObject({ kind: "song", selectedKey: "G" });
    });

    it("defaults selectedKey from chart", async () => {
      const leader = await actorFor(prisma, "user-leader");
      const updated = await service.replaceItems(leader, "sl-items", {
        expectedVersion: 1,
        items: [{ kind: "song", songId: FIXTURE_SONG.id, chartId: FIXTURE_CHART.id, selectedKey: "A" }],
      });
      expect(updated.items[0]).toMatchObject({ selectedKey: "A" });
    });

    it("preserves item ids when reordering", async () => {
      const leader = await actorFor(prisma, "user-leader");
      const first = await service.replaceItems(leader, "sl-items", {
        expectedVersion: 1,
        items: [
          { kind: "song", songId: FIXTURE_SONG.id, chartId: FIXTURE_CHART.id },
          { kind: "note", text: "Nota" },
        ],
      });
      const firstIds = first.items.map((item) => item.id);
      const reordered = await service.replaceItems(leader, "sl-items", {
        expectedVersion: first.version,
        items: [
          { id: firstIds[1], kind: "note", text: "Nota" },
          { id: firstIds[0], kind: "song", songId: FIXTURE_SONG.id, chartId: FIXTURE_CHART.id },
        ],
      });
      const ids = reordered.items.map((item) => item.id).sort();
      expect(ids).toEqual([...firstIds].sort());
    });

    it("rejects invalid keys", async () => {
      const leader = await actorFor(prisma, "user-leader");
      await expect(
        service.replaceItems(leader, "sl-items", {
          expectedVersion: 1,
          items: [
            {
              kind: "song",
              songId: FIXTURE_SONG.id,
              chartId: FIXTURE_CHART.id,
              selectedKey: "H#",
            },
          ],
        }),
      ).rejects.toMatchObject({ code: "INVALID_KEY" });
    });

    it("rejects chart from another song", async () => {
      const leader = await actorFor(prisma, "user-leader");
      await expect(
        service.replaceItems(leader, "sl-items", {
          expectedVersion: 1,
          items: [{ kind: "song", songId: "other-song", chartId: FIXTURE_CHART.id }],
        }),
      ).rejects.toMatchObject({ code: "INVALID_ITEM" });
      const unchanged = await repository.findById("sl-items");
      expect(unchanged?.items).toHaveLength(0);
    });

    it("rejects duplicate song/chart pairs", async () => {
      const leader = await actorFor(prisma, "user-leader");
      await expect(
        service.replaceItems(leader, "sl-items", {
          expectedVersion: 1,
          items: [
            { kind: "song", songId: FIXTURE_SONG.id, chartId: FIXTURE_CHART.id },
            { kind: "song", songId: FIXTURE_SONG.id, chartId: FIXTURE_CHART.id },
          ],
        }),
      ).rejects.toMatchObject({ code: "INVALID_ITEM" });
    });

    it("rejects version conflicts without changing items", async () => {
      const leader = await actorFor(prisma, "user-leader");
      await service.replaceItems(leader, "sl-items", {
        expectedVersion: 1,
        items: [{ kind: "note", text: "A" }],
      });
      await expect(
        service.replaceItems(leader, "sl-items", {
          expectedVersion: 1,
          items: [{ kind: "note", text: "B" }],
        }),
      ).rejects.toMatchObject({ code: "SETLIST_VERSION_CONFLICT" });
      const current = await repository.findById("sl-items");
      expect(current?.items[0]).toMatchObject({ text: "A" });
    });

    it("rejects cross-organization charts", async () => {
      await prisma.organization.create({
        data: { id: "org-other", slug: "other", name: "Other" },
      });
      await prisma.song.create({
        data: {
          id: "song-other",
          organizationId: "org-other",
          title: "Other",
          label: "Other",
          alternateKeys: [],
          meta: "",
          searchText: "other",
        },
      });
      await prisma.chordChart.create({
        data: {
          id: "chart-other",
          organizationId: "org-other",
          songId: "song-other",
          format: "lyrics",
          key: "C",
          timeSignature: "4/4",
          sections: [],
        },
      });
      const leader = await actorFor(prisma, "user-leader");
      await expect(
        service.replaceItems(leader, "sl-items", {
          expectedVersion: 1,
          items: [{ kind: "song", songId: "song-other", chartId: "chart-other" }],
        }),
      ).rejects.toMatchObject({ code: "INVALID_ITEM" });
    });

    it("denies replace for unauthorized actor", async () => {
      const musician = await actorFor(prisma, "user-musician");
      await expect(
        service.replaceItems(musician, "sl-items", {
          expectedVersion: 1,
          items: [{ kind: "note", text: "X" }],
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects missing chart id", async () => {
      const leader = await actorFor(prisma, "user-leader");
      await expect(
        service.replaceItems(leader, "sl-items", {
          expectedVersion: 1,
          items: [{ kind: "song", songId: FIXTURE_SONG.id, chartId: "missing" }],
        }),
      ).rejects.toMatchObject({ code: "INVALID_ITEM" });
    });

    it("allows sequential writes with fresh versions", async () => {
      const leader = await actorFor(prisma, "user-leader");
      const first = await service.replaceItems(leader, "sl-items", {
        expectedVersion: 1,
        items: [{ kind: "note", text: "1" }],
      });
      const second = await service.replaceItems(leader, "sl-items", {
        expectedVersion: first.version,
        items: [{ kind: "note", text: "2" }],
      });
      expect(second.items[0]).toMatchObject({ text: "2" });
      expect(second.version).toBe(first.version + 1);
    });

    it("survives first concurrent version write", async () => {
      const leader = await actorFor(prisma, "user-leader");
      const first = await service.replaceItems(leader, "sl-items", {
        expectedVersion: 1,
        items: [{ kind: "note", text: "winner" }],
      });
      expect(first.version).toBe(2);
      await expect(
        service.replaceItems(leader, "sl-items", {
          expectedVersion: 1,
          items: [{ kind: "note", text: "loser" }],
        }),
      ).rejects.toBeInstanceOf(SetlistError);
    });

    it("stores item notes", async () => {
      const leader = await actorFor(prisma, "user-leader");
      const updated = await service.replaceItems(leader, "sl-items", {
        expectedVersion: 1,
        items: [{ kind: "note", text: "Texto", notes: "Detalhe" }],
      });
      expect(updated.items[0]).toMatchObject({ notes: "Detalhe" });
    });
  });

  describe("update and delete", () => {
    beforeEach(async () => {
      await repository.create({
        id: "sl-life",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: "team-louvor",
        title: "Life",
        status: "draft",
        visibility: "team",
      });
    });

    it("publishes draft setlist", async () => {
      const leader = await actorFor(prisma, "user-leader");
      const updated = await service.updateMeta(leader, "sl-life", {
        expectedVersion: 1,
        status: "published",
      });
      expect(updated.status).toBe("published");
    });

    it("archives published setlist", async () => {
      const leader = await actorFor(prisma, "user-leader");
      await service.updateMeta(leader, "sl-life", { expectedVersion: 1, status: "published" });
      const archived = await service.updateMeta(leader, "sl-life", {
        expectedVersion: 2,
        status: "archived",
      });
      expect(archived.status).toBe("archived");
    });

    it("restores archived setlist to published", async () => {
      const leader = await actorFor(prisma, "user-leader");
      await service.updateMeta(leader, "sl-life", { expectedVersion: 1, status: "published" });
      await service.updateMeta(leader, "sl-life", { expectedVersion: 2, status: "archived" });
      const restored = await service.updateMeta(leader, "sl-life", {
        expectedVersion: 3,
        status: "published",
      });
      expect(restored.status).toBe("published");
    });

    it("rejects illegal status transitions", async () => {
      const leader = await actorFor(prisma, "user-leader");
      await expect(
        service.updateMeta(leader, "sl-life", { expectedVersion: 1, status: "archived" }),
      ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
    });

    it("rejects draft transition from published", async () => {
      const leader = await actorFor(prisma, "user-leader");
      await service.updateMeta(leader, "sl-life", { expectedVersion: 1, status: "published" });
      await expect(
        service.updateMeta(leader, "sl-life", { expectedVersion: 2, status: "draft" }),
      ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
    });

    it("requires follower confirmation before visibility change", async () => {
      await service.updateMeta(await actorFor(prisma, "user-leader"), "sl-life", {
        expectedVersion: 1,
        status: "published",
      });
      await repository.follow("sl-life", "team-jovens");
      const leader = await actorFor(prisma, "user-leader");
      await expect(
        service.updateMeta(leader, "sl-life", {
          expectedVersion: 2,
          visibility: "private",
        }),
      ).rejects.toMatchObject({ code: "SETLIST_HAS_FOLLOWERS", extras: { followerCount: 1 } });
    });

    it("updates visibility after follower confirmation", async () => {
      const leader = await actorFor(prisma, "user-leader");
      await service.updateMeta(leader, "sl-life", { expectedVersion: 1, status: "published" });
      await repository.follow("sl-life", "team-jovens");
      const updated = await service.updateMeta(leader, "sl-life", {
        expectedVersion: 2,
        visibility: "private",
        confirmFollowersImpact: true,
      });
      expect(updated.visibility).toBe("private");
    });

    it("soft deletes with confirmation when followers exist", async () => {
      const leader = await actorFor(prisma, "user-leader");
      await service.updateMeta(leader, "sl-life", { expectedVersion: 1, status: "published" });
      await repository.follow("sl-life", "team-jovens");
      await expect(
        service.delete(leader, "sl-life", { expectedVersion: 2 }),
      ).rejects.toMatchObject({ code: "SETLIST_HAS_FOLLOWERS" });
      await service.delete(leader, "sl-life", {
        expectedVersion: 2,
        confirmFollowersImpact: true,
      });
      await expect(service.getReadable(leader, "sl-life")).rejects.toMatchObject({
        code: "SETLIST_NOT_FOUND",
      });
    });

    it("rejects invalid organization visibility on update", async () => {
      const admin = await actorFor(prisma, "user-admin");
      const orgSetlist = await service.create(admin, { title: "Org", owner: "organization" });
      await expect(
        service.updateMeta(admin, orgSetlist.id, {
          expectedVersion: orgSetlist.version,
          visibility: "team",
        }),
      ).rejects.toMatchObject({ code: "INVALID_VISIBILITY" });
    });

    it("returns version conflict on stale update", async () => {
      const leader = await actorFor(prisma, "user-leader");
      await service.updateMeta(leader, "sl-life", { expectedVersion: 1, title: "A" });
      await expect(
        service.updateMeta(leader, "sl-life", { expectedVersion: 1, title: "B" }),
      ).rejects.toMatchObject({ code: "SETLIST_VERSION_CONFLICT" });
      const current = await repository.findById("sl-life");
      expect(current?.title).toBe("A");
    });

    it("updates title and notes", async () => {
      const leader = await actorFor(prisma, "user-leader");
      const updated = await service.updateMeta(leader, "sl-life", {
        expectedVersion: 1,
        title: "Novo título",
        notes: "Notas",
      });
      expect(updated.title).toBe("Novo título");
      expect(updated.notes).toBe("Notas");
    });

    it("denies update for non-editor", async () => {
      const musician = await actorFor(prisma, "user-musician");
      await expect(
        service.updateMeta(musician, "sl-life", { expectedVersion: 1, title: "Hack" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("follow", () => {
    it("follows readable published setlist", async () => {
      await repository.create({
        id: "sl-follow",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: "team-jovens",
        title: "Follow",
        status: "published",
        visibility: "organization",
      });
      const leader = await actorFor(prisma, "user-leader");
      await service.follow(leader, "sl-follow", { teamId: "team-louvor" });
      const record = await repository.findById("sl-follow");
      expect(record?.followerTeamIds).toContain("team-louvor");
    });

    it("is idempotent on repeat follow", async () => {
      await repository.create({
        id: "sl-follow-idempotent",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: "team-jovens",
        title: "Follow",
        status: "published",
        visibility: "organization",
      });
      const leader = await actorFor(prisma, "user-leader");
      await service.follow(leader, "sl-follow-idempotent", { teamId: "team-louvor" });
      await service.follow(leader, "sl-follow-idempotent", { teamId: "team-louvor" });
      const record = await repository.findById("sl-follow-idempotent");
      expect(record?.followerTeamIds).toEqual(["team-louvor"]);
    });

    it("unfollows without error when missing", async () => {
      await repository.create({
        id: "sl-unfollow",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: "team-jovens",
        title: "Unfollow",
        status: "published",
        visibility: "organization",
      });
      const leader = await actorFor(prisma, "user-leader");
      await service.unfollow(leader, "sl-unfollow", { teamId: "team-louvor" });
    });

    it("rejects following draft setlists", async () => {
      await repository.create({
        id: "sl-draft-follow",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: "team-jovens",
        title: "Draft",
        status: "draft",
        visibility: "team",
      });
      const leader = await actorFor(prisma, "user-leader");
      await expect(
        service.follow(leader, "sl-draft-follow", { teamId: "team-louvor" }),
      ).rejects.toMatchObject({ code: "CANNOT_FOLLOW" });
    });

    it("rejects following own team setlist", async () => {
      await createPublishedTeamSetlist("sl-own", "team-louvor");
      const leader = await actorFor(prisma, "user-leader");
      await expect(
        service.follow(leader, "sl-own", { teamId: "team-louvor" }),
      ).rejects.toMatchObject({ code: "CANNOT_FOLLOW" });
    });

    it("rejects unreadable targets", async () => {
      await repository.create({
        id: "sl-private-follow",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: "team-jovens",
        title: "Private",
        status: "published",
        visibility: "private",
      });
      const leader = await actorFor(prisma, "user-leader");
      await expect(
        service.follow(leader, "sl-private-follow", { teamId: "team-louvor" }),
      ).rejects.toMatchObject({ code: "CANNOT_FOLLOW" });
    });

    it("denies follow for non-leader on destination team", async () => {
      await createPublishedTeamSetlist("sl-follow-deny", "team-jovens");
      const musician = await actorFor(prisma, "user-musician");
      await expect(
        service.follow(musician, "sl-follow-deny", { teamId: "team-louvor" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("denies unfollow for unauthorized actor", async () => {
      await repository.create({
        id: "sl-unfollow-deny",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: "team-jovens",
        title: "Unfollow deny",
        status: "published",
        visibility: "organization",
      });
      const musician = await actorFor(prisma, "user-musician");
      await expect(
        service.unfollow(musician, "sl-unfollow-deny", { teamId: "team-louvor" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("clone", () => {
    beforeEach(async () => {
      await repository.create({
        id: "sl-source",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: "team-jovens",
        title: "Origem",
        status: "published",
        visibility: "organization",
      });
      await repository.replaceItems("sl-source", 1, [
        {
          id: "item-source",
          kind: "song",
          songId: FIXTURE_SONG.id,
          chartId: FIXTURE_CHART.id,
          selectedKey: "G",
        },
      ]);
    });

    it("clones to another team as draft", async () => {
      const leader = await actorFor(prisma, "user-leader");
      const cloned = await service.clone(leader, "sl-source", { targetTeamId: "team-louvor" });
      expect(cloned.status).toBe("draft");
      expect(cloned.ownerTeamId).toBe("team-louvor");
      expect(cloned.id).not.toBe("sl-source");
      expect(cloned.items).toHaveLength(1);
    });

    it("clones to organization for admin", async () => {
      const admin = await actorFor(prisma, "user-admin");
      const cloned = await service.clone(admin, "sl-source", { target: "organization" });
      expect(cloned.ownerTeamId).toBeNull();
      expect(cloned.visibility).toBe("organization");
    });

    it("rejects cloning drafts", async () => {
      await repository.create({
        id: "sl-draft-clone",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: "team-jovens",
        title: "Draft",
        status: "draft",
        visibility: "team",
      });
      const leader = await actorFor(prisma, "user-leader");
      await expect(
        service.clone(leader, "sl-draft-clone", { targetTeamId: "team-louvor" }),
      ).rejects.toMatchObject({ code: "CANNOT_CLONE" });
    });

    it("rejects unreadable clone sources", async () => {
      await repository.create({
        id: "sl-private-clone",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: "team-jovens",
        title: "Private",
        status: "published",
        visibility: "private",
      });
      const leader = await actorFor(prisma, "user-leader");
      await expect(
        service.clone(leader, "sl-private-clone", { targetTeamId: "team-louvor" }),
      ).rejects.toMatchObject({ code: "CANNOT_CLONE" });
    });

    it("denies clone for unauthorized destination", async () => {
      const musician = await actorFor(prisma, "user-musician");
      await expect(
        service.clone(musician, "sl-source", { targetTeamId: "team-louvor" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("keeps clone independent from source", async () => {
      const leader = await actorFor(prisma, "user-leader");
      const cloned = await service.clone(leader, "sl-source", { targetTeamId: "team-louvor" });
      await service.updateMeta(leader, cloned.id, { expectedVersion: cloned.version, title: "Clone" });
      const source = await repository.findById("sl-source");
      expect(source?.title).toBe("Origem");
    });

    it("reuses target charts by origin url across organizations", async () => {
      await prisma.organization.create({
        data: { id: "org-remote", slug: "remote", name: "Remote" },
      });
      await prisma.song.create({
        data: {
          id: "song-remote",
          organizationId: "org-remote",
          title: "Remote",
          label: "Remote",
          alternateKeys: [],
          meta: "",
          searchText: "remote",
        },
      });
      await prisma.chordChart.create({
        data: {
          id: "chart-remote",
          organizationId: "org-remote",
          songId: "song-remote",
          format: "lyrics",
          key: "C",
          timeSignature: "4/4",
          sections: [],
          originUrl: "https://www.cifraclub.com.br/remote/song/",
        },
      });
      await repository.create({
        id: "sl-remote",
        organizationId: "org-remote",
        ownerTeamId: null,
        title: "Remote",
        status: "published",
        visibility: "public",
      });
      const sharedOrigin = "https://www.cifraclub.com.br/remote/song/";
      await prisma.chordChart.create({
        data: {
          id: "chart-local-reuse",
          organizationId: DEFAULT_ORGANIZATION_ID,
          songId: FIXTURE_SONG.id,
          format: "lyrics",
          key: "D",
          timeSignature: "4/4",
          sections: [],
          originUrl: sharedOrigin,
        },
      });
      await prisma.chordChart.update({
        where: { id: "chart-remote" },
        data: { originUrl: sharedOrigin },
      });
      await repository.replaceItems("sl-remote", 1, [
        { id: "item-remote", kind: "song", songId: "song-remote", chartId: "chart-remote", selectedKey: "C" },
      ]);
      const admin = await actorFor(prisma, "user-admin");
      const cloned = await service.clone(admin, "sl-remote", { target: "organization" });
      expect(cloned.items[0]).toMatchObject({ chartId: "chart-local-reuse" });
    });

    it("copies songs with sourceOrganizationId across organizations", async () => {
      await prisma.organization.create({
        data: { id: "org-src", slug: "src", name: "Src" },
      });
      await prisma.song.create({
        data: {
          id: "song-src-only",
          organizationId: "org-src",
          title: "Src",
          label: "Src",
          alternateKeys: [],
          meta: "",
          searchText: "src",
        },
      });
      await prisma.chordChart.create({
        data: {
          id: "chart-src-only",
          organizationId: "org-src",
          songId: "song-src-only",
          format: "lyrics",
          key: "E",
          timeSignature: "4/4",
          sections: [],
        },
      });
      await repository.create({
        id: "sl-cross",
        organizationId: "org-src",
        ownerTeamId: null,
        title: "Cross",
        status: "published",
        visibility: "public",
      });
      await repository.replaceItems("sl-cross", 1, [
        {
          id: "item-cross",
          kind: "song",
          songId: "song-src-only",
          chartId: "chart-src-only",
          selectedKey: "E",
        },
      ]);
      const admin = await actorFor(prisma, "user-admin");
      const cloned = await service.clone(admin, "sl-cross", { target: "organization" });
      const newSongId = (cloned.items[0] as { songId: string }).songId;
      const copied = await prisma.song.findUnique({ where: { id: newSongId } });
      expect(copied?.sourceOrganizationId).toBe("org-src");
    });

    it("does not expose source reference on clone", async () => {
      const leader = await actorFor(prisma, "user-leader");
      const cloned = await service.clone(leader, "sl-source", { targetTeamId: "team-louvor" });
      const row = await prisma.setlist.findUnique({ where: { id: cloned.id } });
      expect(row).not.toHaveProperty("sourceSetlistId");
    });

    it("rejects organization clone for leader", async () => {
      const leader = await actorFor(prisma, "user-leader");
      await expect(
        service.clone(leader, "sl-source", { target: "organization" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("authorship", () => {
    it("stores createdByUserId on create", async () => {
      const leader = await actorFor(prisma, "user-leader");
      const created = await service.create(leader, {
        title: "Do líder",
        ownerTeamId: "team-louvor",
      });
      const row = await repository.findById(created.id);
      expect(row?.createdByUserId).toBe("user-leader");
    });

    it("lets the author update title and notes without setlist capability", async () => {
      await repository.create({
        id: "sl-author-only",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: "team-louvor",
        createdByUserId: "user-musician",
        title: "Rascunho",
        status: "draft",
        visibility: "team",
      });
      const musician = await actorFor(prisma, "user-musician");
      const updated = await service.updateMeta(musician, "sl-author-only", {
        expectedVersion: 1,
        title: "Ajustado",
        notes: "Notas",
      });
      expect(updated.title).toBe("Ajustado");
      expect(updated.notes).toBe("Notas");
    });

    it("forbids the author from changing visibility or status", async () => {
      await repository.create({
        id: "sl-author-meta",
        organizationId: DEFAULT_ORGANIZATION_ID,
        ownerTeamId: "team-louvor",
        createdByUserId: "user-musician",
        title: "Rascunho",
        status: "draft",
        visibility: "team",
      });
      const musician = await actorFor(prisma, "user-musician");
      await expect(
        service.updateMeta(musician, "sl-author-meta", {
          expectedVersion: 1,
          visibility: "organization",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        service.updateMeta(musician, "sl-author-meta", {
          expectedVersion: 1,
          status: "published",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });
});
