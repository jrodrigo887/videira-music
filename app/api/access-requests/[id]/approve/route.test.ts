import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAuthApiTestContext, type AuthApiTestContext } from "@/lib/auth/auth-route-test-helpers";
import { ensureSystemRoles } from "@/lib/roles/role-service";

import { POST } from "./route";

describe("POST /api/access-requests/[id]/approve", () => {
  let context: AuthApiTestContext;
  let requestId: string;

  beforeEach(async () => {
    context = await createAuthApiTestContext("user-admin");
    await ensureSystemRoles(context.prisma, "org-default");
    const row = await context.prisma.accessRequest.create({
      data: {
        organizationId: "org-default",
        email: "approve-api@videira.test",
        name: "API",
        status: "pending",
      },
    });
    requestId = row.id;
  });

  afterEach(async () => {
    await context.prisma.user.deleteMany({ where: { email: "approve-api@videira.test" } });
    await context.cleanup();
  });

  it("approves for admin", async () => {
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: ["musician"], teamIds: [] }),
      }),
      { params: Promise.resolve({ id: requestId }) },
    );
    expect(response.status).toBe(200);
  });

  it("returns 403 when manager grants admin", async () => {
    context.asUser("user-manager");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: ["admin"], teamIds: [] }),
      }),
      { params: Promise.resolve({ id: requestId }) },
    );
    expect(response.status).toBe(403);
  });
});
