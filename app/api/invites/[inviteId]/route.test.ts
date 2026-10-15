import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAuthApiTestContext, type AuthApiTestContext } from "@/lib/auth/auth-route-test-helpers";
import { generateInviteCode } from "@/lib/invites/invite-token";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/persistence/organization-scope";

import { DELETE } from "./route";

describe("DELETE /api/invites/[inviteId]", () => {
  let context: AuthApiTestContext;

  beforeEach(async () => {
    context = await createAuthApiTestContext("user-admin");
  });

  afterEach(async () => {
    await context.cleanup();
  });

  it("revokes a pending invite", async () => {
    const { hash } = generateInviteCode();
    const invite = await context.prisma.invite.create({
      data: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        email: "revogar@videira.test",
        tokenHash: hash,
        roles: ["musician"],
        teamIds: [],
        expiresAt: new Date(Date.now() + 86400000),
        createdByUserId: "user-admin",
      },
    });

    const response = await DELETE(new Request("http://local"), {
      params: Promise.resolve({ inviteId: invite.id }),
    });
    expect(response.status).toBe(204);

    const row = await context.prisma.invite.findUnique({ where: { id: invite.id } });
    expect(row?.revokedAt).not.toBeNull();
  });

  it("returns 403 for musician", async () => {
    context.asUser("user-musician");
    const response = await DELETE(new Request("http://local"), {
      params: Promise.resolve({ inviteId: "missing" }),
    });
    expect(response.status).toBe(403);
  });
});
