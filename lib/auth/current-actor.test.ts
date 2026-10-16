import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";
import {
  createTempDatabaseUrl,
  createTestPrismaClient,
  destroyTestPrismaClient,
} from "@/lib/persistence/test-temp-db";

import { seedSimulatedIdentities } from "./simulated-identities";
import { resolveViewAsForActor } from "./resolve-view-as";
import { loadActorForUser } from "./load-actor";
import { testUserActor } from "./test-actor";

describe("resolveViewAsForActor", () => {
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

  it("returns the target actor with viewAs metadata", async () => {
    const admin = await loadActorForUser(prisma, "user-admin");
    if (admin.kind !== "user") throw new Error("expected admin");

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await prisma.viewAsSession.create({
      data: {
        viewerUserId: "user-admin",
        targetUserId: "user-musician",
        reason: "support",
        expiresAt,
      },
    });

    const effective = await resolveViewAsForActor(prisma, admin);
    if (effective.kind !== "user") throw new Error("expected user");
    expect(effective.userId).toBe("user-musician");
    expect(effective.viewAs).toEqual({
      realUserId: "user-admin",
      expiresAt: expiresAt.toISOString(),
    });
    expect(effective.delegations).toEqual([]);

    await prisma.viewAsSession.deleteMany({ where: { viewerUserId: "user-admin" } });
  });

  it("does not carry the viewer delegations onto the target", async () => {
    const admin = testUserActor({
      userId: "user-admin",
      organizationId: DEFAULT_ORGANIZATION_ID,
      roles: ["admin"],
      teams: [],
      delegations: [
        {
          capabilities: ["setlists:all"],
          teamIds: [],
          expiresAt: "2099-01-01T00:00:00.000Z",
        },
      ],
    });

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await prisma.viewAsSession.create({
      data: {
        viewerUserId: "user-admin",
        targetUserId: "user-musician",
        reason: "audit",
        expiresAt,
      },
    });

    const effective = await resolveViewAsForActor(prisma, admin);
    if (effective.kind !== "user") throw new Error("expected user");
    expect(effective.userId).toBe("user-musician");
    expect(effective.delegations).toEqual([]);

    await prisma.viewAsSession.deleteMany({ where: { viewerUserId: "user-admin" } });
  });

  it("ends expired sessions and returns the real actor", async () => {
    const admin = await loadActorForUser(prisma, "user-admin");
    if (admin.kind !== "user") throw new Error("expected admin");

    const expired = new Date(Date.now() - 60_000);
    const session = await prisma.viewAsSession.create({
      data: {
        viewerUserId: "user-admin",
        targetUserId: "user-musician",
        reason: "expired",
        expiresAt: expired,
      },
    });

    const effective = await resolveViewAsForActor(prisma, admin);
    expect(effective).toMatchObject({ kind: "user", userId: "user-admin" });

    const row = await prisma.viewAsSession.findUnique({ where: { id: session.id } });
    expect(row?.endedAt).not.toBeNull();
    const audit = await prisma.authAuditLog.findFirst({
      where: { action: "view_as.end", actorUserId: "user-admin" },
      orderBy: { occurredAt: "desc" },
    });
    expect(audit).not.toBeNull();

    await prisma.viewAsSession.deleteMany({ where: { id: session.id } });
  });
});
