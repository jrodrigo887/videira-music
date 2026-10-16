import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAuthApiTestContext, type AuthApiTestContext } from "@/lib/auth/auth-route-test-helpers";

import { GET } from "./route";

describe("GET /api/members", () => {
  let context: AuthApiTestContext;

  beforeEach(async () => {
    context = await createAuthApiTestContext("user-admin");
  });

  afterEach(async () => {
    await context.cleanup();
  });

  it("lists members for admin", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.members.length).toBeGreaterThanOrEqual(3);
    expect(body.members.some((m: { email: string }) => m.email === "admin@videira.test")).toBe(
      true,
    );
  });

  it("returns 403 for musician", async () => {
    context.asUser("user-musician");
    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("returns 200 for manager", async () => {
    context.asUser("user-manager");
    const response = await GET();
    expect(response.status).toBe(200);
  });
});
