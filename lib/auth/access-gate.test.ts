import type { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateInviteCode } from "@/lib/invites/invite-token";
import {
  createTempDatabaseUrl,
  createTestPrismaClient,
  destroyTestPrismaClient,
} from "@/lib/persistence/test-temp-db";
import { resetPrismaClientForTests } from "@/lib/persistence/prisma-client";

import { completeOAuthSignIn, validateUserInfo } from "./access-gate";
import { seedSimulatedIdentities } from "./simulated-identities";

const oauthState = vi.hoisted(() => ({ inviteCode: undefined as string | undefined }));

vi.mock("better-auth/api", () => ({
  getOAuthState: vi.fn(async () => oauthState),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  })),
}));

vi.mock("./auth-config", () => ({
  readAuthEnvConfig: vi.fn(() => ({
    secret: "test-secret-at-least-32-characters-long",
    baseUrl: "http://localhost:3000",
    googleClientId: "google-id",
    googleClientSecret: "google-secret",
    bootstrapAdminEmail: "bootstrap@videira.test",
  })),
}));

function oauthProfile(email: string, verified = true) {
  return {
    user: { email, name: "Test User" },
    source: {
      action: "sign-in" as const,
      method: "oauth",
      oauth: { providerId: "google", profile: { email, email_verified: verified } },
    },
  };
}

describe("Google OAuth access gate", () => {
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

  beforeEach(() => {
    resetPrismaClientForTests();
    process.env.DATABASE_URL = temp.url;
    oauthState.inviteCode = undefined;
  });

  afterEach(async () => {
    await prisma.authSession.deleteMany();
    await prisma.authAccount.deleteMany();
    await prisma.authUser.deleteMany();
  });

  it("AUTH-03: recusa e-mail Google não verificado", async () => {
    const result = await validateUserInfo(
      oauthProfile("musico@videira.test", false),
    );
    expect(result).toEqual({ error: "email_not_verified" });
  });

  it("AUTH-02: recusa sign-in sem membro ativo", async () => {
    const result = await validateUserInfo(
      oauthProfile("desconhecido@example.com"),
    );
    expect(result).toEqual({ error: "no_access" });
  });

  it("AUTH-01: permite sign-in de membro ativo", async () => {
    const result = await validateUserInfo(oauthProfile("musico@videira.test"));
    expect(result).toBeUndefined();
  });

  it("AUTH-04: recusa membro desativado", async () => {
    await prisma.user.update({
      where: { id: "user-musician" },
      data: { status: "deactivated" },
    });

    const result = await validateUserInfo(oauthProfile("musico@videira.test"));
    expect(result).toEqual({ error: "no_access" });

    await prisma.user.update({
      where: { id: "user-musician" },
      data: { status: "active" },
    });
  });

  it("AUTH-42: bootstrap cria admin quando não há admin ativo", async () => {
    await prisma.userRole.deleteMany({ where: { role: "admin" } });

    const createUser = {
      user: { email: "bootstrap@videira.test", name: "Bootstrap" },
      source: {
        action: "create-user" as const,
        method: "oauth",
        oauth: {
          providerId: "google",
          profile: { email: "bootstrap@videira.test", email_verified: true },
        },
      },
    };

    const gate = await validateUserInfo(createUser);
    expect(gate).toBeUndefined();

    const outcome = await completeOAuthSignIn({
      id: "auth-bootstrap",
      email: "bootstrap@videira.test",
      name: "Bootstrap",
    });
    expect(outcome).toBe("ok");

    const admin = await prisma.user.findFirst({
      where: { email: "bootstrap@videira.test" },
      include: { roles: true },
    });
    expect(admin?.roles.map((role) => role.role)).toContain("admin");

    await prisma.userRole.upsert({
      where: { userId_role: { userId: "user-admin", role: "admin" } },
      create: { userId: "user-admin", role: "admin" },
      update: {},
    });
    await prisma.user.deleteMany({ where: { email: "bootstrap@videira.test" } });
  });

  it("AUTH-16: aceita convite válido no primeiro login", async () => {
    const { code, hash } = generateInviteCode();
    await prisma.invite.create({
      data: {
        organizationId: "org-default",
        email: "novo@videira.test",
        tokenHash: hash,
        roles: ["musician"],
        teamIds: [],
        expiresAt: new Date(Date.now() + 86400000),
        createdByUserId: "user-admin",
      },
    });
    oauthState.inviteCode = code;

    const createUser = {
      user: { email: "novo@videira.test", name: "Novo Membro" },
      source: {
        action: "create-user" as const,
        method: "oauth",
        oauth: {
          providerId: "google",
          profile: { email: "novo@videira.test", email_verified: true },
        },
      },
    };

    expect(await validateUserInfo(createUser)).toBeUndefined();

    const outcome = await completeOAuthSignIn({
      id: "auth-novo",
      email: "novo@videira.test",
      name: "Novo Membro",
    });
    expect(outcome).toBe("ok");

    const member = await prisma.user.findFirst({
      where: { email: "novo@videira.test" },
      include: { roles: true },
    });
    expect(member?.roles.map((role) => role.role)).toEqual(["musician"]);

    await prisma.user.deleteMany({ where: { email: "novo@videira.test" } });
  });

  it("AUTH-17: recusa create-user quando o e-mail difere do convite", async () => {
    const { code, hash } = generateInviteCode();
    await prisma.invite.create({
      data: {
        organizationId: "org-default",
        email: "convidado@videira.test",
        tokenHash: hash,
        roles: ["musician"],
        teamIds: [],
        expiresAt: new Date(Date.now() + 86400000),
        createdByUserId: "user-admin",
      },
    });
    oauthState.inviteCode = code;

    const result = await validateUserInfo({
      user: { email: "outro@videira.test", name: "Outro" },
      source: {
        action: "create-user",
        method: "oauth",
        oauth: {
          providerId: "google",
          profile: { email: "outro@videira.test", email_verified: true },
        },
      },
    });

    expect(result).toEqual({ error: "invite_email_mismatch" });
  });
});
