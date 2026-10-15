import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { UserActor } from "@/lib/auth/actor";
import {
  acceptInvite,
  createInvite,
  revokeInvite,
} from "@/lib/invites/invite-service";
import {
  deactivateMember,
  setMemberRoles,
} from "@/lib/members/member-service";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import { resetPrismaClientForTests } from "@/lib/persistence/prisma-client";
import {
  createTempDatabaseUrl,
  createTestPrismaClient,
  destroyTestPrismaClient,
} from "@/lib/persistence/test-temp-db";

import { seedSimulatedIdentities } from "./simulated-identities";

import { testUserActor } from "./test-actor";

function adminActor(): UserActor {
  return testUserActor({
    userId: "user-admin",
    organizationId: DEFAULT_ORGANIZATION_ID,
    roles: ["admin"],
    teams: [],
  });
}

function auditPayload(log: {
  action: string;
  actorUserId: string | null;
  targetEmail: string | null;
  targetUserId: string | null;
  details: unknown;
}): string {
  return JSON.stringify(log);
}

describe("AuthAuditLog (AUTH-53, AUTH-54)", () => {
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

  beforeEach(async () => {
    resetPrismaClientForTests();
    process.env.DATABASE_URL = temp.url;
    await prisma.authAuditLog.deleteMany();
    await prisma.invite.deleteMany();
  });

  it("records invite.create and invite.revoke without the raw token", async () => {
    const actor = adminActor();
    const { invite, code } = await createInvite(prisma, actor, {
      email: "audit-create@videira.test",
      roles: ["musician"],
      teamIds: [],
      expiresInHours: 24,
    });

    await revokeInvite(prisma, actor, invite.id);

    const logs = await prisma.authAuditLog.findMany({ orderBy: { occurredAt: "asc" } });
    expect(logs.map((row) => row.action)).toEqual(["invite.create", "invite.revoke"]);

    for (const row of logs) {
      expect(auditPayload(row)).not.toContain(code);
      expect(auditPayload(row)).not.toMatch(/token/i);
    }

    expect(logs[0]?.actorUserId).toBe("user-admin");
    expect(logs[0]?.targetEmail).toBe("audit-create@videira.test");
    expect(logs[1]?.targetEmail).toBe("audit-create@videira.test");
  });

  it("records invite.accept without the invite code", async () => {
    const actor = adminActor();
    const { code } = await createInvite(prisma, actor, {
      email: "audit-accept@videira.test",
      roles: ["musician"],
      teamIds: [],
      expiresInHours: 24,
    });

    const outcome = await acceptInvite(prisma, {
      code,
      authUserId: "auth-audit-accept",
      email: "audit-accept@videira.test",
      name: "Audit Accept",
    });
    expect(outcome).toBe("accepted");

    const log = await prisma.authAuditLog.findFirst({
      where: { action: "invite.accept" },
    });
    expect(log).not.toBeNull();
    expect(log!.targetEmail).toBe("audit-accept@videira.test");
    expect(log!.targetUserId).toBeTruthy();
    expect(auditPayload(log!)).not.toContain(code);
  });

  it("records roles.change and user.deactivate", async () => {
    const actor = adminActor();
    const { code } = await createInvite(prisma, actor, {
      email: "audit-member@videira.test",
      roles: ["musician"],
      teamIds: [],
      expiresInHours: 24,
    });
    await acceptInvite(prisma, {
      code,
      authUserId: "auth-audit-member",
      email: "audit-member@videira.test",
      name: "Audit Member",
    });
    const member = await prisma.user.findFirst({
      where: { email: "audit-member@videira.test" },
      select: { id: true },
    });
    expect(member).not.toBeNull();

    await setMemberRoles(prisma, actor, member!.id, ["musician", "worship_leader"]);
    await deactivateMember(prisma, actor, member!.id);

    const logs = await prisma.authAuditLog.findMany({
      where: {
        action: { in: ["roles.change", "user.deactivate"] },
        targetUserId: member!.id,
      },
      orderBy: { occurredAt: "asc" },
    });
    expect(logs.map((row) => row.action)).toEqual(["roles.change", "user.deactivate"]);
    expect(logs[0]?.actorUserId).toBe("user-admin");
  });
});
