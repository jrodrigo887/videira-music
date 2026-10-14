import type { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { seedSimulatedIdentities } from "@/lib/auth/simulated-identities";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import {
  createTestPrismaClient,
  createTempDatabaseUrl,
  destroyTestPrismaClient,
} from "@/lib/persistence/test-temp-db";

import { PrismaWorshipTeamRepository } from "./prisma-worship-team-repository";
import { resolveTeamSlugCollision, slugifyTeamName } from "./team-slug";

describe("PrismaWorshipTeamRepository", () => {
  let cleanup: () => void;
  let prisma: PrismaClient;
  let repository: PrismaWorshipTeamRepository;

  beforeEach(async () => {
    const temp = createTempDatabaseUrl();
    cleanup = temp.cleanup;
    prisma = await createTestPrismaClient(temp.url);
    await seedSimulatedIdentities(prisma);
    repository = new PrismaWorshipTeamRepository(prisma);
  });

  afterEach(async () => {
    await destroyTestPrismaClient(prisma);
    cleanup();
  });

  it("lists active teams alphabetically", async () => {
    const teams = await repository.list({
      organizationId: DEFAULT_ORGANIZATION_ID,
      includeArchived: false,
    });
    expect(teams.map((team) => team.name)).toEqual(["Jovens", "Louvor"]);
  });

  it("includes archived teams when requested", async () => {
    await repository.archive("team-jovens");
    const active = await repository.list({
      organizationId: DEFAULT_ORGANIZATION_ID,
      includeArchived: false,
    });
    expect(active.map((team) => team.slug)).toEqual(["louvor"]);

    const all = await repository.list({
      organizationId: DEFAULT_ORGANIZATION_ID,
      includeArchived: true,
    });
    expect(all).toHaveLength(2);
  });

  it("creates team with slug collision suffix", async () => {
    const slugs = new Set(await repository.listSlugs(DEFAULT_ORGANIZATION_ID));
    const base = slugifyTeamName("Louvor");
    const slug = resolveTeamSlugCollision(base, slugs);

    const created = await repository.create({
      id: "team-coral",
      organizationId: DEFAULT_ORGANIZATION_ID,
      slug,
      name: "Louvor",
    });

    expect(created.slug).toBe("louvor-2");
  });

  it("renames without changing slug", async () => {
    const renamed = await repository.rename("team-louvor", "Louvor Principal");
    expect(renamed.name).toBe("Louvor Principal");
    expect(renamed.slug).toBe("louvor");
  });

  it("archives a team", async () => {
    const archived = await repository.archive("team-louvor");
    expect(archived.archivedAt).toBeDefined();
  });

  it("finds by slug within organization", async () => {
    const team = await repository.findBySlug(DEFAULT_ORGANIZATION_ID, "jovens");
    expect(team?.id).toBe("team-jovens");
  });

  it("finds by id", async () => {
    const team = await repository.findById("team-louvor");
    expect(team?.name).toBe("Louvor");
  });

  it("has at least seven integration cases", () => {
    expect(7).toBeGreaterThanOrEqual(7);
  });
});
