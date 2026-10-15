import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { testUserActor } from "@/lib/auth/test-actor";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import { resetPrismaClientForTests } from "@/lib/persistence/prisma-client";
import {
  createTempDatabaseUrl,
  createTestPrismaClient,
  destroyTestPrismaClient,
} from "@/lib/persistence/test-temp-db";

import { seedSimulatedIdentities } from "@/lib/auth/simulated-identities";

import {
  createRole,
  deleteRole,
  listRoles,
  RoleServiceError,
  updateRole,
} from "./role-service";

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

describe("role-service", () => {
  let temp!: { url: string; cleanup: () => Promise<void> };
  let prisma: PrismaClient;

  beforeAll(async () => {
    temp = await createTempDatabaseUrl();
    prisma = await createTestPrismaClient(temp.url);
    await seedSimulatedIdentities(prisma);
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
  });

  afterAll(async () => {
    await destroyTestPrismaClient(prisma);
    await temp.cleanup();
  });

  beforeEach(() => {
    resetPrismaClientForTests();
    process.env.DATABASE_URL = temp.url;
  });

  it("lists system roles after ensureSystemRoles", async () => {
    const roles = await listRoles(prisma, admin());
    expect(roles.some((role) => role.key === "admin" && role.system)).toBe(true);
    expect(roles.find((role) => role.key === "musician")?.capabilities).toEqual([]);
  });

  it("creates a custom role for admin", async () => {
    const created = await createRole(prisma, admin(), {
      label: "Intercessão",
      capabilities: [],
    });
    expect(created.key).toBe("intercessao");
    expect(created.system).toBe(false);
  });

  it("forbids manager from creating roles", async () => {
    await expect(
      createRole(prisma, manager(), { label: "Novo", capabilities: [] }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("rejects duplicate names", async () => {
    await expect(
      createRole(prisma, admin(), { label: "Intercessão", capabilities: [] }),
    ).rejects.toMatchObject({ code: "ROLE_EXISTS" });
  });

  it("rejects invalid capabilities", async () => {
    await expect(
      createRole(prisma, admin(), { label: "Outro Papel", capabilities: ["not-a-cap"] }),
    ).rejects.toMatchObject({ code: "INVALID_ROLE" });
  });

  it("updates label while keeping key", async () => {
    const updated = await updateRole(prisma, admin(), "intercessao", {
      label: "Intercessão Atualizada",
    });
    expect(updated.label).toBe("Intercessão Atualizada");
    expect(updated.key).toBe("intercessao");
  });

  it("updates capabilities on custom role", async () => {
    const updated = await updateRole(prisma, admin(), "intercessao", {
      capabilities: ["import"],
    });
    expect(updated.capabilities).toEqual(["import"]);
  });

  it("refuses to update system role", async () => {
    await expect(
      updateRole(prisma, admin(), "admin", { label: "Super" }),
    ).rejects.toMatchObject({ code: "SYSTEM_ROLE" });
  });

  it("deletes unused custom role", async () => {
    await deleteRole(prisma, admin(), "intercessao");
    const roles = await listRoles(prisma, admin());
    expect(roles.some((role) => role.key === "intercessao")).toBe(false);
  });

  it("refuses delete when role is assigned", async () => {
    const created = await createRole(prisma, admin(), {
      label: "Em Uso",
      capabilities: [],
    });
    await prisma.userRole.create({
      data: { userId: "user-musician", role: created.key },
    });
    await expect(deleteRole(prisma, admin(), created.key)).rejects.toMatchObject({
      code: "ROLE_IN_USE",
    });
    await prisma.userRole.deleteMany({ where: { role: created.key } });
    await deleteRole(prisma, admin(), created.key);
  });

  it("writes audit log on create", async () => {
    await createRole(prisma, admin(), { label: "Auditado", capabilities: [] });
    const log = await prisma.authAuditLog.findFirst({
      where: { action: "role.create" },
      orderBy: { occurredAt: "desc" },
    });
    expect(log?.details).toMatchObject({ key: "auditado" });
    await deleteRole(prisma, admin(), "auditado");
  });
});

describe("RoleServiceError", () => {
  it("is instanceof Error", () => {
    expect(new RoleServiceError(400, "INVALID_ROLE")).toBeInstanceOf(Error);
  });
});
