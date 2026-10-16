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
import { ensureSystemRoles } from "@/lib/roles/role-service";

import {
  approveAccessRequest,
  listPendingAccessRequests,
  rejectAccessRequest,
  submitAccessRequest,
} from "./access-request-service";

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

describe("access-request-service", () => {
  let temp!: { url: string; cleanup: () => Promise<void> };
  let prisma: PrismaClient;
  let requestId: string;

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
    await ensureSystemRoles(prisma, DEFAULT_ORGANIZATION_ID);
  });

  afterAll(async () => {
    await destroyTestPrismaClient(prisma);
    await temp.cleanup();
  });

  beforeEach(async () => {
    resetPrismaClientForTests();
    process.env.DATABASE_URL = temp.url;
    await prisma.accessRequest.deleteMany();
    const testEmails = ["pedido@videira.test", "lider@videira.test"];
    const testUsers = await prisma.user.findMany({
      where: { email: { in: testEmails } },
      select: { id: true },
    });
    for (const user of testUsers) {
      await prisma.worshipTeamMember.deleteMany({ where: { userId: user.id } });
      await prisma.userRole.deleteMany({ where: { userId: user.id } });
    }
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await submitAccessRequest(prisma, DEFAULT_ORGANIZATION_ID, {
      email: "pedido@videira.test",
      name: "Pedido Teste",
    });
    const row = await prisma.accessRequest.findFirstOrThrow({
      where: { email: "pedido@videira.test" },
    });
    requestId = row.id;
  });

  it("lists pending requests for admin only", async () => {
    const pending = await listPendingAccessRequests(prisma, admin());
    expect(pending.some((item) => item.email === "pedido@videira.test")).toBe(true);
    await expect(listPendingAccessRequests(prisma, manager())).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
  });

  it("upserts pending request for same email", async () => {
    await submitAccessRequest(prisma, DEFAULT_ORGANIZATION_ID, {
      email: "pedido@videira.test",
      name: "Nome Novo",
    });
    const count = await prisma.accessRequest.count({
      where: { organizationId: DEFAULT_ORGANIZATION_ID, email: "pedido@videira.test" },
    });
    expect(count).toBe(1);
    const row = await prisma.accessRequest.findFirstOrThrow({
      where: { email: "pedido@videira.test" },
    });
    expect(row.name).toBe("Nome Novo");
  });

  it("approves and creates active member without authUserId", async () => {
    await approveAccessRequest(prisma, admin(), requestId, {
      roles: ["musician"],
      teamIds: [],
    });
    const user = await prisma.user.findFirst({
      where: { email: "pedido@videira.test" },
    });
    expect(user?.status).toBe("active");
    expect(user?.authUserId).toBeNull();
    const pending = await listPendingAccessRequests(prisma, admin());
    expect(pending.some((item) => item.id === requestId)).toBe(false);
  });

  it("forbids manager from approving or rejecting requests", async () => {
    await expect(
      approveAccessRequest(prisma, manager(), requestId, {
        roles: ["musician"],
        teamIds: [],
      }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    await expect(rejectAccessRequest(prisma, manager(), requestId)).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
    const stillPending = await prisma.accessRequest.findFirst({
      where: { id: requestId, status: "pending" },
    });
    expect(stillPending).not.toBeNull();
  });

  it("rejects manager granting admin", async () => {
    await expect(
      approveAccessRequest(prisma, manager(), requestId, {
        roles: ["admin"],
        teamIds: [],
      }),
    ).rejects.toMatchObject({ status: 403 });
    const stillPending = await prisma.accessRequest.findFirst({
      where: { id: requestId, status: "pending" },
    });
    expect(stillPending).not.toBeNull();
  });

  it("rejects when active user exists", async () => {
    await prisma.user.create({
      data: {
        id: "user-pedido-existing",
        organizationId: DEFAULT_ORGANIZATION_ID,
        name: "Existente",
        email: "pedido@videira.test",
        status: "active",
      },
    });
    await expect(
      approveAccessRequest(prisma, admin(), requestId, {
        roles: ["musician"],
        teamIds: [],
      }),
    ).rejects.toMatchObject({ code: "USER_EXISTS" });
  });

  it("rejects empty roles", async () => {
    await prisma.user.deleteMany({ where: { email: "pedido@videira.test" } });
    await expect(
      approveAccessRequest(prisma, admin(), requestId, { roles: [], teamIds: [] }),
    ).rejects.toMatchObject({ code: "INVALID_ROLE" });
  });

  it("rejects invalid team", async () => {
    await expect(
      approveAccessRequest(prisma, admin(), requestId, {
        roles: ["musician"],
        teamIds: ["team-missing"],
      }),
    ).rejects.toMatchObject({ code: "INVALID_TEAM" });
  });

  it("reject marks request rejected", async () => {
    await rejectAccessRequest(prisma, admin(), requestId);
    const row = await prisma.accessRequest.findFirstOrThrow({ where: { id: requestId } });
    expect(row.status).toBe("rejected");
  });

  it("reopened rejected request becomes pending on new submit", async () => {
    await rejectAccessRequest(prisma, admin(), requestId);
    await submitAccessRequest(prisma, DEFAULT_ORGANIZATION_ID, {
      email: "pedido@videira.test",
      name: "De Volta",
    });
    const row = await prisma.accessRequest.findFirstOrThrow({ where: { id: requestId } });
    expect(row.status).toBe("pending");
  });

  it("second approve returns REQUEST_RESOLVED", async () => {
    await approveAccessRequest(prisma, admin(), requestId, {
      roles: ["musician"],
      teamIds: [],
    });
    await expect(
      approveAccessRequest(prisma, admin(), requestId, {
        roles: ["musician"],
        teamIds: [],
      }),
    ).rejects.toMatchObject({ code: "REQUEST_RESOLVED" });
  });

  it("creates team membership as leader when setlists:led", async () => {
    await prisma.accessRequest.deleteMany();
    await submitAccessRequest(prisma, DEFAULT_ORGANIZATION_ID, {
      email: "lider@videira.test",
      name: "Lider",
    });
    const req = await prisma.accessRequest.findFirstOrThrow({
      where: { email: "lider@videira.test" },
    });
    await approveAccessRequest(prisma, admin(), req.id, {
      roles: ["worship_leader"],
      teamIds: ["team-louvor"],
    });
    const membership = await prisma.worshipTeamMember.findUnique({
      where: { teamId_userId: { teamId: "team-louvor", userId: (await prisma.user.findFirstOrThrow({ where: { email: "lider@videira.test" } })).id } },
    });
    expect(membership?.role).toBe("leader");
  });

  it("writes audit on submit", async () => {
    const log = await prisma.authAuditLog.findFirst({
      where: { action: "access_request.create", targetEmail: "pedido@videira.test" },
    });
    expect(log).not.toBeNull();
  });
});
