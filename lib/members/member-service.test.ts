import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { seedSimulatedIdentities } from "@/lib/auth/simulated-identities";
import { testUserActor } from "@/lib/auth/test-actor";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import { resetPrismaClientForTests } from "@/lib/persistence/prisma-client";
import {
  createTempDatabaseUrl,
  createTestPrismaClient,
  destroyTestPrismaClient,
} from "@/lib/persistence/test-temp-db";
import { ensureSystemRoles } from "@/lib/roles/role-service";

import {
  deactivateMember,
  listMembers,
  setMemberRoles,
} from "./member-service";

function admin() {
  return testUserActor({
    userId: "user-admin",
    organizationId: DEFAULT_ORGANIZATION_ID,
    roles: ["admin"],
    teams: [],
  });
}

function manager() {
  return testUserActor({
    userId: "user-manager",
    organizationId: DEFAULT_ORGANIZATION_ID,
    roles: ["manager"],
    teams: [],
  });
}

function musician() {
  return testUserActor({
    userId: "user-musician",
    organizationId: DEFAULT_ORGANIZATION_ID,
    roles: ["musician"],
    teams: [],
  });
}

describe("member-service", () => {
  let temp!: { url: string; cleanup: () => Promise<void> };
  let prisma: PrismaClient;

  beforeAll(async () => {
    temp = await createTempDatabaseUrl();
    prisma = await createTestPrismaClient(temp.url);
    await seedSimulatedIdentities(prisma);
    await ensureSystemRoles(prisma, DEFAULT_ORGANIZATION_ID);
    await prisma.user.upsert({
      where: { id: "user-manager" },
      create: {
        id: "user-manager",
        organizationId: DEFAULT_ORGANIZATION_ID,
        name: "Gestor",
        email: "gestor@videira.test",
        status: "active",
      },
      update: {},
    });
    await prisma.userRole.upsert({
      where: { userId_role: { userId: "user-manager", role: "manager" } },
      create: { userId: "user-manager", role: "manager" },
      update: {},
    });
    resetPrismaClientForTests();
    process.env.DATABASE_URL = temp.url;
  });

  afterAll(async () => {
    await destroyTestPrismaClient(prisma);
    await temp.cleanup();
  });

  it("lets manager list members but not change roles", async () => {
    const members = await listMembers(prisma, manager());
    expect(members.some((member) => member.id === "user-musician")).toBe(true);

    const before = await prisma.userRole.findMany({ where: { userId: "user-musician" } });
    await expect(
      setMemberRoles(prisma, manager(), "user-musician", ["musician", "worship_leader"]),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    const after = await prisma.userRole.findMany({ where: { userId: "user-musician" } });
    expect(after.map((row) => row.role).sort()).toEqual(before.map((row) => row.role).sort());
  });

  it("forbids musician from listing members", async () => {
    await expect(listMembers(prisma, musician())).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
  });

  it("lets admin change roles and blocks manager from granting admin", async () => {
    await setMemberRoles(prisma, admin(), "user-musician", ["worship_leader"]);
    const roles = await prisma.userRole.findMany({ where: { userId: "user-musician" } });
    expect(roles.map((row) => row.role)).toEqual(["worship_leader"]);

    await expect(
      setMemberRoles(prisma, manager(), "user-musician", ["admin"]),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });

    await setMemberRoles(prisma, admin(), "user-musician", ["musician"]);
  });

  it("forbids manager from deactivating members", async () => {
    await expect(deactivateMember(prisma, manager(), "user-musician")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: "user-musician" } });
    expect(user.status).toBe("active");
  });

  it("refuses to remove the only active admin", async () => {
    await expect(
      setMemberRoles(prisma, admin(), "user-admin", ["manager"]),
    ).rejects.toMatchObject({ status: 409, code: "LAST_ADMIN" });
  });

  it("refuses to deactivate the only active admin", async () => {
    await expect(deactivateMember(prisma, admin(), "user-admin")).rejects.toMatchObject({
      status: 409,
      code: "LAST_ADMIN",
    });
  });
});
