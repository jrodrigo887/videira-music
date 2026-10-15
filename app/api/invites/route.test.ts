import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAuthApiTestContext, type AuthApiTestContext } from "@/lib/auth/auth-route-test-helpers";

import { GET, POST } from "./route";

describe("/api/invites", () => {
  let context: AuthApiTestContext;

  beforeEach(async () => {
    context = await createAuthApiTestContext("user-admin");
  });

  afterEach(async () => {
    await context.cleanup();
  });

  it("lists pending invites for admin", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.invites)).toBe(true);
  });

  it("returns 403 for musician", async () => {
    context.asUser("user-musician");
    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("creates an invite for admin", async () => {
    const response = await POST(
      new Request("http://localhost/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "novo-convite@videira.test",
          roles: ["musician"],
          teamIds: [],
          expiresInHours: 168,
        }),
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.link).toMatch(/^\/convite\//);
  });

  it("returns 403 when manager invites admin role", async () => {
    context.asUser("user-manager");
    const response = await POST(
      new Request("http://localhost/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin-attempt@videira.test",
          roles: ["admin"],
          teamIds: [],
          expiresInHours: 24,
        }),
      }),
    );
    expect(response.status).toBe(403);
  });

  it("returns 409 when active user already exists", async () => {
    const response = await POST(
      new Request("http://localhost/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "musico@videira.test",
          roles: ["musician"],
          teamIds: [],
          expiresInHours: 24,
        }),
      }),
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "USER_EXISTS" },
    });
  });

  it("returns 400 for invalid expiry", async () => {
    const response = await POST(
      new Request("http://localhost/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "expiry@videira.test",
          roles: ["musician"],
          teamIds: [],
          expiresInHours: 0.5,
        }),
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_EXPIRY" },
    });
  });
});
