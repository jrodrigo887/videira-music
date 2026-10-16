import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTempDatabaseUrl,
  createTestPrismaClient,
  destroyTestPrismaClient,
} from "@/lib/persistence/test-temp-db";

import { hasCapability, isOrganizationAdmin, teamRoleOf } from "./actor";
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

  it("loads capabilities from system roles", async () => {
    const leader = await loadActorForUser(prisma, "user-leader");
    if (leader.kind !== "user") throw new Error("expected user");
    expect(hasCapability(leader, "setlists:led", "org-default")).toBe(true);
    expect(hasCapability(leader, "user.manage", "org-default")).toBe(false);
  });

  it("loads custom role capabilities from RoleDefinition", async () => {
    await prisma.roleDefinition.create({
      data: {
        organizationId: "org-default",
        key: "import-only",
        label: "Import Only",
        system: false,
        capabilities: ["import"],
      },
    });
    await prisma.userRole.create({
      data: { userId: "user-musician", role: "import-only" },
    });
    const actor = await loadActorForUser(prisma, "user-musician");
    if (actor.kind !== "user") throw new Error("expected user");
    expect(actor.roles).toContain("import-only");
    expect(hasCapability(actor, "import", "org-default")).toBe(true);
    expect(hasCapability(actor, "music:write", "org-default")).toBe(true);
    await prisma.userRole.deleteMany({ where: { role: "import-only" } });
    await prisma.roleDefinition.deleteMany({ where: { key: "import-only" } });
  });

  it("ignores unknown role keys", async () => {
    await prisma.userRole.create({
      data: { userId: "user-musician", role: "fantasma" },
    });
    const actor = await loadActorForUser(prisma, "user-musician");
    if (actor.kind !== "user") throw new Error("expected user");
    expect(actor.roles).not.toContain("fantasma");
    await prisma.userRole.deleteMany({ where: { role: "fantasma" } });
  });

  it("ignores legacy users:manage in stored capabilities", async () => {
    await prisma.roleDefinition.create({
      data: {
        organizationId: "org-default",
        key: "legacy-manage",
        label: "Legacy",
        system: false,
        capabilities: ["users:manage", "import"],
      },
    });
    await prisma.userRole.create({
      data: { userId: "user-musician", role: "legacy-manage" },
    });
    const actor = await loadActorForUser(prisma, "user-musician");
    if (actor.kind !== "user") throw new Error("expected user");
    expect(actor.capabilities).not.toContain("users:manage");
    expect(hasCapability(actor, "member.manage", "org-default")).toBe(false);
    expect(hasCapability(actor, "user.manage", "org-default")).toBe(false);
    expect(hasCapability(actor, "import", "org-default")).toBe(true);
    expect(hasCapability(actor, "music:write", "org-default")).toBe(true);
    await prisma.userRole.deleteMany({ where: { role: "legacy-manage" } });
    await prisma.roleDefinition.deleteMany({ where: { key: "legacy-manage" } });
  });

  it("becomes anonymous when every role key is unknown", async () => {
    await prisma.userRole.deleteMany({ where: { userId: "user-musician" } });
    await prisma.userRole.create({
      data: { userId: "user-musician", role: "fantasma" },
    });
    await expect(loadActorForUser(prisma, "user-musician")).resolves.toEqual({ kind: "anonymous" });
    await prisma.userRole.deleteMany({ where: { userId: "user-musician" } });
    await prisma.userRole.create({
      data: { userId: "user-musician", role: "musician" },
    });
  });
});
