import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTempDatabaseUrl,
  createTestPrismaClient,
  destroyTestPrismaClient,
} from "@/lib/persistence/test-temp-db";

import { isOrganizationAdmin, teamRoleOf } from "./actor";
import { loadActorForUser } from "./load-actor";
import { seedSimulatedIdentities } from "./simulated-identities";

describe("loadActorForUser", () => {
  let temp!: { url: string; cleanup: () => Promise<void> };
  let prisma: PrismaClient;

  beforeAll(async () => {
    temp = await createTempDatabaseUrl();
    prisma = await createTestPrismaClient(temp.url);
    await seedSimulatedIdentities(prisma);
  });

  afterAll(async () => {
    await destroyTestPrismaClient(prisma);
    await temp.cleanup();
  });

  it("loads the organization role and team memberships", async () => {
    const actor = await loadActorForUser(prisma, "user-musician");

    expect(actor).toMatchObject({ kind: "user", userId: "user-musician", roles: ["musician"] });
    expect(teamRoleOf(actor, "team-louvor")).toBe("member");
    expect(teamRoleOf(actor, "team-jovens")).toBe("member");
    expect(isOrganizationAdmin(actor, "org-default")).toBe(false);
  });

  it("recognizes the organization admin and team leader", async () => {
    const admin = await loadActorForUser(prisma, "user-admin");
    const leader = await loadActorForUser(prisma, "user-leader");

    expect(isOrganizationAdmin(admin, "org-default")).toBe(true);
    expect(isOrganizationAdmin(admin, "org-other")).toBe(false);
    expect(teamRoleOf(leader, "team-louvor")).toBe("leader");
    expect(teamRoleOf(leader, "team-jovens")).toBeUndefined();
  });

  it("ignores memberships of archived teams", async () => {
    await prisma.worshipTeam.update({
      where: { id: "team-jovens" },
      data: { archivedAt: new Date() },
    });

    const actor = await loadActorForUser(prisma, "user-musician");

    expect(teamRoleOf(actor, "team-jovens")).toBeUndefined();
    expect(teamRoleOf(actor, "team-louvor")).toBe("member");
  });

  it("treats an unknown user as anonymous", async () => {
    await expect(loadActorForUser(prisma, "user-missing")).resolves.toEqual({ kind: "anonymous" });
  });
});
