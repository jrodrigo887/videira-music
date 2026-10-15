import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAuthApiTestContext, type AuthApiTestContext } from "@/lib/auth/auth-route-test-helpers";

import { PUT } from "./route";

describe("PUT /api/teams/[teamId]/leaders (AUTH-23)", () => {
  let context: AuthApiTestContext;

  beforeEach(async () => {
    context = await createAuthApiTestContext("user-admin");
  });

  afterEach(async () => {
    await context.cleanup();
  });

  it("returns 400 NOT_A_WORSHIP_LEADER when assigning a musician as team leader", async () => {
    const response = await PUT(
      new Request("http://local", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: ["user-musician"] }),
      }),
      { params: Promise.resolve({ teamId: "team-louvor" }) },
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "NOT_A_WORSHIP_LEADER" },
    });
  });

  it("assigns worship leaders to the team", async () => {
    const response = await PUT(
      new Request("http://local", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: ["user-leader"] }),
      }),
      { params: Promise.resolve({ teamId: "team-jovens" }) },
    );
    expect(response.status).toBe(204);

    const membership = await context.prisma.worshipTeamMember.findUnique({
      where: { teamId_userId: { teamId: "team-jovens", userId: "user-leader" } },
    });
    expect(membership?.role).toBe("leader");
  });
});
