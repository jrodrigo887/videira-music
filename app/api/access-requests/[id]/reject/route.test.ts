import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAuthApiTestContext, type AuthApiTestContext } from "@/lib/auth/auth-route-test-helpers";

import { POST } from "./route";

describe("POST /api/access-requests/[id]/reject", () => {
  let context: AuthApiTestContext;
  let requestId: string;

  beforeEach(async () => {
    context = await createAuthApiTestContext("user-admin");
    const row = await context.prisma.accessRequest.create({
      data: {
        organizationId: "org-default",
        email: "reject-api@videira.test",
        name: "Reject",
        status: "pending",
      },
    });
    requestId = row.id;
  });

  afterEach(async () => {
    await context.cleanup();
  });

  it("rejects pending request", async () => {
    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: requestId }),
    });
    expect(response.status).toBe(200);
    const row = await context.prisma.accessRequest.findUniqueOrThrow({ where: { id: requestId } });
    expect(row.status).toBe("rejected");
  });

  it("returns 403 for musician", async () => {
    context.asUser("user-musician");
    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ id: requestId }),
    });
    expect(response.status).toBe(403);
  });
});
