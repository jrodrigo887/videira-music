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

import { deleteSong, restoreSong } from "./song-trash-service";

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

describe("song-trash-service", () => {
  let temp!: { url: string; cleanup: () => Promise<void> };
  let prisma: PrismaClient;
  const songId = "song-trash-test";

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
    await prisma.song.create({
      data: {
        id: songId,
        organizationId: DEFAULT_ORGANIZATION_ID,
        title: "Para lixeira",
        label: "Para lixeira",
        alternateKeys: [],
        meta: "",
        searchText: "para lixeira",
        publicLyrics: false,
      },
    });
  });

  afterAll(async () => {
    await destroyTestPrismaClient(prisma);
    await temp.cleanup();
  });

  beforeEach(async () => {
    resetPrismaClientForTests();
    process.env.DATABASE_URL = temp.url;
    await prisma.song.update({
      where: { id: songId },
      data: { deletedAt: null },
    });
  });

  it("soft-deletes a song and audits", async () => {
    await deleteSong(prisma, manager(), songId);
    const row = await prisma.song.findUnique({ where: { id: songId } });
    expect(row?.deletedAt).not.toBeNull();
    const audit = await prisma.authAuditLog.findFirst({
      where: { action: "song.delete", actorUserId: "user-manager" },
      orderBy: { occurredAt: "desc" },
    });
    expect(audit?.details).toMatchObject({ songId });
  });

  it("restores a trashed song", async () => {
    await deleteSong(prisma, manager(), songId);
    await restoreSong(prisma, manager(), songId);
    const row = await prisma.song.findUnique({ where: { id: songId } });
    expect(row?.deletedAt).toBeNull();
  });

  it("returns 409 when restoring a song not in trash", async () => {
    await expect(restoreSong(prisma, manager(), songId)).rejects.toMatchObject({
      status: 409,
      code: "SONG_NOT_DELETED",
    });
  });

  it("returns 404 for unknown song or second delete", async () => {
    await expect(deleteSong(prisma, manager(), "missing-song")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
    await deleteSong(prisma, manager(), songId);
    await expect(deleteSong(prisma, manager(), songId)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("returns 403 without music:delete", async () => {
    await expect(deleteSong(prisma, musician(), songId)).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
  });
});
