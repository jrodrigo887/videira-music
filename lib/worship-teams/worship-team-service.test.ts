import type { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SetlistError } from "@/lib/setlists/setlist-errors";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import {
  createTestPrismaClient,
  createTempDatabaseUrl,
  destroyTestPrismaClient,
} from "@/lib/persistence/test-temp-db";

import { actorFor, seedSetlistFixture } from "@/lib/setlists/setlist-test-fixture";

import { PrismaWorshipTeamRepository } from "./prisma-worship-team-repository";
import { createWorshipTeamService } from "./worship-team-service";

describe("WorshipTeamService", () => {
  let cleanup: () => Promise<void>;
  let prisma: PrismaClient;
  let service: ReturnType<typeof createWorshipTeamService>;

  beforeEach(async () => {
    const temp = await createTempDatabaseUrl();
    cleanup = temp.cleanup;
    prisma = await createTestPrismaClient(temp.url);
    await seedSetlistFixture(prisma);
    service = createWorshipTeamService({
      organizationId: DEFAULT_ORGANIZATION_ID,
      repository: new PrismaWorshipTeamRepository(prisma),
      newId: () => `team-${Math.random().toString(36).slice(2, 8)}`,
    });
  });

  afterEach(async () => {
    await destroyTestPrismaClient(prisma);
    await cleanup();
  });

  it("lists teams for admin including archived when requested", async () => {
    const admin = await actorFor(prisma, "user-admin");
    await service.archiveTeam(admin, "team-jovens");
    const active = await service.listTeams(admin, { includeArchived: false });
    expect(active.map((team) => team.slug)).toEqual(["louvor"]);
    const all = await service.listTeams(admin, { includeArchived: true });
    expect(all).toHaveLength(2);
  });

  it("denies listTeams for non-admin", async () => {
    const leader = await actorFor(prisma, "user-leader");
    await expect(service.listTeams(leader, { includeArchived: false })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("creates a team with slug collision suffix", async () => {
    const admin = await actorFor(prisma, "user-admin");
    const created = await service.createTeam(admin, { name: "Louvor" });
    expect(created.slug).toBe("louvor-2");
  });

  it("denies createTeam for non-admin", async () => {
    const leader = await actorFor(prisma, "user-leader");
    await expect(service.createTeam(leader, { name: "Coral" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects invalid team names", async () => {
    const admin = await actorFor(prisma, "user-admin");
    await expect(service.createTeam(admin, { name: "   " })).rejects.toBeInstanceOf(SetlistError);
  });

  it("renames a team without changing slug", async () => {
    const admin = await actorFor(prisma, "user-admin");
    const renamed = await service.renameTeam(admin, "team-louvor", "Louvor Principal");
    expect(renamed.name).toBe("Louvor Principal");
    expect(renamed.slug).toBe("louvor");
  });

  it("archives a team for admin", async () => {
    const admin = await actorFor(prisma, "user-admin");
    const archived = await service.archiveTeam(admin, "team-jovens");
    expect(archived.archivedAt).toBeDefined();
  });

  it("returns all active teams for admin in teamsSelectableBy", async () => {
    const admin = await actorFor(prisma, "user-admin");
    const teams = await service.teamsSelectableBy(admin);
    expect(teams.map((team) => team.name)).toEqual(["Jovens", "Louvor"]);
  });

  it("returns only member teams for musicians alphabetically", async () => {
    const musician = await actorFor(prisma, "user-musician");
    const teams = await service.teamsSelectableBy(musician);
    expect(teams.map((team) => team.slug)).toEqual(["jovens", "louvor"]);
  });

  it("returns empty selectable teams for anonymous actors", async () => {
    await expect(service.teamsSelectableBy({ kind: "anonymous" })).resolves.toEqual([]);
  });
});
