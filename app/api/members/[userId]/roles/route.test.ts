import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAuthApiTestContext, type AuthApiTestContext } from "@/lib/auth/auth-route-test-helpers";

import { PUT } from "./route";

describe("PUT /api/members/[userId]/roles", () => {
  let context: AuthApiTestContext;

  beforeEach(async () => {
    context = await createAuthApiTestContext("user-admin");
  });

  afterEach(async () => {
    await context.cleanup();
  });

  it("updates roles for a member", async () => {
    const response = await PUT(
      new Request("http://local", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: ["musician", "worship_leader"] }),
      }),
      { params: Promise.resolve({ userId: "user-musician" }) },
    );
    expect(response.status).toBe(204);

    const roles = await context.prisma.userRole.findMany({
      where: { userId: "user-musician" },
    });
    expect(roles.map((row) => row.role).sort()).toEqual(["musician", "worship_leader"]);
  });

  it("returns 409 when removing the last admin", async () => {
    await context.prisma.userRole.deleteMany({
      where: { userId: "user-admin", role: { not: "admin" } },
    });

    const response = await PUT(
      new Request("http://local", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: ["manager"] }),
      }),
      { params: Promise.resolve({ userId: "user-admin" }) },
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "LAST_ADMIN" },
    });
  });

  it("returns 403 when manager changes an admin user", async () => {
    context.asUser("user-manager");
    const response = await PUT(
      new Request("http://local", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: ["manager"] }),
      }),
      { params: Promise.resolve({ userId: "user-admin" }) },
    );
    expect(response.status).toBe(403);
  });
});
