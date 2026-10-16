import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { teamRoleOf } from "@/lib/auth/actor";
import { testUserActor } from "@/lib/auth/test-actor";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import { resetPrismaClientForTests } from "@/lib/persistence/prisma-client";
import {
  createTempDatabaseUrl,
  createTestPrismaClient,
  destroyTestPrismaClient,
} from "@/lib/persistence/test-temp-db";

import { seedSimulatedIdentities } from "@/lib/auth/simulated-identities";

import { createInvite } from "./invite-service";

function leaderActor() {
  return testUserActor({
    userId: "user-leader",
    organizationId: DEFAULT_ORGANIZATION_ID,
    roles: ["worship_leader"],
    teams: [{ teamId: "team-louvor", role: "leader" }],
  });
}

function managerActor() {
  return testUserActor({
    userId: "user-manager",
    organizationId: DEFAULT_ORGANIZATION_ID,
    roles: ["manager"],
    teams: [],
  });
}

function musicianActor() {
  return testUserActor({
    userId: "user-musician",
    organizationId: DEFAULT_ORGANIZATION_ID,
    roles: ["musician"],
    teams: [{ teamId: "team-louvor", role: "member" }],
  });
}

describe("createInvite leader branch", () => {
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

  it("lets a team leader invite a musician to a led team", async () => {
    const result = await createInvite(prisma, leaderActor(), {
      email: "novo.musico@example.com",
      roles: ["musician"],
      teamIds: ["team-louvor"],
      expiresInHours: 24,
    });
    expect(result.invite.roles).toEqual(["musician"]);
    expect(result.invite.teamIds).toEqual(["team-louvor"]);
    const audit = await prisma.authAuditLog.findFirst({
      where: { action: "invite.create", actorUserId: "user-leader" },
      orderBy: { occurredAt: "desc" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects leader invite without users:invite or users:invite:led", async () => {
    await expect(
      createInvite(prisma, musicianActor(), {
        email: "x@example.com",
        roles: ["musician"],
        teamIds: ["team-louvor"],
        expiresInHours: 24,
      }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("rejects leader invite for a team they do not lead", async () => {
    expect(teamRoleOf(leaderActor(), "team-jovens")).toBeUndefined();
    await expect(
      createInvite(prisma, leaderActor(), {
        email: "outro@example.com",
        roles: ["musician"],
        teamIds: ["team-jovens"],
        expiresInHours: 24,
      }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("rejects leader invite with empty teams or non-musician role", async () => {
    await expect(
      createInvite(prisma, leaderActor(), {
        email: "a@example.com",
        roles: ["musician"],
        teamIds: [],
        expiresInHours: 24,
      }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    await expect(
      createInvite(prisma, leaderActor(), {
        email: "b@example.com",
        roles: ["worship_leader"],
        teamIds: ["team-louvor"],
        expiresInHours: 24,
      }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("rejects invalid email and existing active user", async () => {
    await expect(
      createInvite(prisma, leaderActor(), {
        email: "sem-arroba",
        roles: ["musician"],
        teamIds: ["team-louvor"],
        expiresInHours: 24,
      }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_REQUEST" });
    await expect(
      createInvite(prisma, leaderActor(), {
        email: "musico@videira.test",
        roles: ["musician"],
        teamIds: ["team-louvor"],
        expiresInHours: 24,
      }),
    ).rejects.toMatchObject({ status: 409, code: "USER_EXISTS" });
  });

  it("lets manager invite to a team they do not lead", async () => {
    const result = await createInvite(prisma, managerActor(), {
      email: "gestor.convida@example.com",
      roles: ["musician"],
      teamIds: ["team-louvor"],
      expiresInHours: 24,
    });
    expect(result.invite.teamIds).toEqual(["team-louvor"]);
  });

  it("rejects archived team for leader-only invite", async () => {
    await prisma.worshipTeam.update({
      where: { id: "team-jovens" },
      data: { archivedAt: new Date() },
    });
    await prisma.worshipTeamMember.upsert({
      where: { teamId_userId: { teamId: "team-jovens", userId: "user-leader" } },
      create: { teamId: "team-jovens", userId: "user-leader", role: "leader" },
      update: { role: "leader" },
    });
    const ledBoth = testUserActor({
      userId: "user-leader",
      organizationId: DEFAULT_ORGANIZATION_ID,
      roles: ["worship_leader"],
      teams: [
        { teamId: "team-louvor", role: "leader" },
        { teamId: "team-jovens", role: "leader" },
      ],
    });
    await expect(
      createInvite(prisma, ledBoth, {
        email: "archived@example.com",
        roles: ["musician"],
        teamIds: ["team-jovens"],
        expiresInHours: 24,
      }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    await prisma.worshipTeam.update({
      where: { id: "team-jovens" },
      data: { archivedAt: null },
    });
    await prisma.worshipTeamMember.deleteMany({
      where: { teamId: "team-jovens", userId: "user-leader" },
    });
  });
});
