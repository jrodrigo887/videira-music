import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAuthApiTestContext, type AuthApiTestContext } from "@/lib/auth/auth-route-test-helpers";

import { GET, POST } from "./route";

describe("/api/roles", () => {
  let context: AuthApiTestContext;

  beforeEach(async () => {
    context = await createAuthApiTestContext("user-admin");
  });

  afterEach(async () => {
    await context.cleanup();
  });

  it("lists roles for admin", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.roles.some((role: { key: string }) => role.key === "admin")).toBe(true);
  });

  it("creates a custom role", async () => {
    const response = await POST(
      new Request("http://localhost/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Diaconia", capabilities: [] }),
      }),
    );
    expect(response.status).toBe(201);
  });

  it("returns 403 for manager on POST", async () => {
    context.asUser("user-manager");
    const response = await POST(
      new Request("http://localhost/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Negado", capabilities: [] }),
      }),
    );
    expect(response.status).toBe(403);
  });

  it("returns 400 for invalid capability", async () => {
    const response = await POST(
      new Request("http://localhost/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Ruim", capabilities: ["nope"] }),
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_ROLE");
  });
});
