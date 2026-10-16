import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ADMIN_ONLY_CAPABILITIES,
  CAPABILITIES,
  closeCapabilities,
  parseStoredCapabilities,
} from "@/lib/auth/capabilities";
import { loadActorForUser } from "@/lib/auth/load-actor";
import { hasCapability } from "@/lib/auth/actor";
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
  listRoleLabels,
  listRoles,
  RoleServiceError,
  updateRole,
} from "./role-service";

const NON_ADMIN_CAPABILITIES = CAPABILITIES.filter(
  (cap) => !ADMIN_ONLY_CAPABILITIES.includes(cap),
);

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

  it("lets manager list role labels but not full roles", async () => {
    const labels = await listRoleLabels(prisma, manager());
    expect(labels.some((role) => role.key === "admin")).toBe(true);
    await expect(listRoles(prisma, manager())).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
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

  it("rejects custom role with org:settings or users:impersonate", async () => {
    const beforeLogs = await prisma.authAuditLog.count({ where: { action: "role.create" } });
    await expect(
      createRole(prisma, admin(), {
        label: "Financeiro",
        capabilities: ["org:settings"],
      }),
    ).rejects.toMatchObject({ status: 409, code: "ROLE_CAPABILITY_FORBIDDEN" });
    await expect(
      createRole(prisma, admin(), {
        label: "Suporte Ver",
        capabilities: ["users:impersonate"],
      }),
    ).rejects.toMatchObject({ status: 409, code: "ROLE_CAPABILITY_FORBIDDEN" });
    const afterLogs = await prisma.authAuditLog.count({ where: { action: "role.create" } });
    expect(afterLogs).toBe(beforeLogs);
  });

  it("allows custom role with music:delete and users:invite:led", async () => {
    const created = await createRole(prisma, admin(), {
      label: "Lider Extra",
      capabilities: ["music:delete", "users:invite:led"],
    });
    expect(created.capabilities).toEqual(
      expect.arrayContaining(["music:delete", "users:invite:led"]),
    );
    await deleteRole(prisma, admin(), created.key);
  });

  it("rejects custom role with admin-only capabilities", async () => {
    const beforeLogs = await prisma.authAuditLog.count({ where: { action: "role.create" } });
    await expect(
      createRole(prisma, admin(), {
        label: "Coordenação",
        capabilities: ["user.manage"],
      }),
    ).rejects.toMatchObject({ status: 409, code: "ADMIN_ONLY_CAPABILITY" });
    const afterLogs = await prisma.authAuditLog.count({ where: { action: "role.create" } });
    expect(afterLogs).toBe(beforeLogs);
    const roles = await listRoles(prisma, admin());
    expect(roles.some((role) => role.key === "coordenacao")).toBe(false);
  });

  it("creates custom role with every non-admin capability", async () => {
    const created = await createRole(prisma, admin(), {
      label: "Quase Admin",
      capabilities: [...NON_ADMIN_CAPABILITIES],
    });
    expect(created.capabilities).toEqual(expect.arrayContaining([...NON_ADMIN_CAPABILITIES]));
    await deleteRole(prisma, admin(), created.key);
  });

  it("rejects update with admin-only capability and keeps stored capabilities", async () => {
    const created = await createRole(prisma, admin(), {
      label: "Parcial",
      capabilities: NON_ADMIN_CAPABILITIES.slice(0, 4),
    });
    await expect(
      updateRole(prisma, admin(), created.key, { capabilities: ["role.manage"] }),
    ).rejects.toMatchObject({ code: "ADMIN_ONLY_CAPABILITY" });
    const row = await prisma.roleDefinition.findUnique({
      where: {
        organizationId_key: { organizationId: DEFAULT_ORGANIZATION_ID, key: created.key },
      },
    });
    expect(parseStoredCapabilities(row?.capabilities)).toEqual(
      closeCapabilities(NON_ADMIN_CAPABILITIES.slice(0, 4)),
    );
    await deleteRole(prisma, admin(), created.key);
  });

  it("updates label without applying admin-set rule", async () => {
    await prisma.roleDefinition.create({
      data: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        key: "legacy-full",
        label: "Legado",
        system: false,
        capabilities: [...CAPABILITIES],
      },
    });
    const updated = await updateRole(prisma, admin(), "legacy-full", { label: "Legado Renomeado" });
    expect(updated.label).toBe("Legado Renomeado");
    expect(updated.capabilities).toEqual([...CAPABILITIES]);
    await deleteRole(prisma, admin(), "legacy-full");
  });

  it("loads legacy custom role with seven capabilities on actor", async () => {
    await prisma.roleDefinition.create({
      data: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        key: "legacy-actor",
        label: "Legado Actor",
        system: false,
        capabilities: [...CAPABILITIES],
      },
    });
    await prisma.userRole.create({
      data: { userId: "user-musician", role: "legacy-actor" },
    });
    const actor = await loadActorForUser(prisma, "user-musician");
    if (actor.kind !== "user") throw new Error("expected user");
    expect(hasCapability(actor, "user.manage", DEFAULT_ORGANIZATION_ID)).toBe(true);
    await prisma.userRole.deleteMany({ where: { role: "legacy-actor" } });
    await prisma.roleDefinition.deleteMany({ where: { key: "legacy-actor" } });
  });

  it("updates label while keeping key", async () => {
    const updated = await updateRole(prisma, admin(), "intercessao", {
      label: "Intercessão Atualizada",
    });
    expect(updated.label).toBe("Intercessão Atualizada");
    expect(updated.key).toBe("intercessao");
  });

  it("updates capabilities on custom role and closes implications", async () => {
    const updated = await updateRole(prisma, admin(), "intercessao", {
      capabilities: ["import"],
    });
    expect(updated.capabilities).toEqual(expect.arrayContaining(["import", "music:write"]));
  });

  it("stores member.manage and users:invite together", async () => {
    const created = await createRole(prisma, admin(), {
      label: "Membros",
      capabilities: ["member.manage"],
    });
    expect(created.capabilities).toEqual(
      expect.arrayContaining(["member.manage", "users:invite"]),
    );
    await deleteRole(prisma, admin(), created.key);
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
