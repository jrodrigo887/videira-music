import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const cookiesMock = vi.hoisted(() =>
  vi.fn(async () => ({
    get: vi.fn(() => undefined),
    set: vi.fn(),
  })),
);

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/auth/auth-config", () => ({
  readAuthEnvConfig: vi.fn(() => ({
    secret: "test-secret-at-least-32-characters-long",
    baseUrl: "http://localhost:3000",
  })),
}));

import { signAccessTicket } from "@/lib/access-requests/access-ticket";
import { createAuthApiTestContext, type AuthApiTestContext } from "@/lib/auth/auth-route-test-helpers";

import { POST } from "./route";

describe("POST /api/access-requests", () => {
  let context: AuthApiTestContext;

  beforeEach(async () => {
    context = await createAuthApiTestContext("user-admin");
    await context.prisma.accessRequest.deleteMany();
  });

  afterEach(async () => {
    await context.cleanup();
  });

  it("returns 400 when cookie is missing", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => undefined),
      set: vi.fn(),
    });
    const response = await POST();
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("ACCESS_TICKET_INVALID");
  });

  it("creates request with valid ticket", async () => {
    const token = signAccessTicket({ email: "ticket@videira.test", name: "Ticket" });
    cookiesMock.mockResolvedValue({
      get: vi.fn((name?: string) => (name ? { value: token } : undefined)),
      set: vi.fn(),
    });
    const response = await POST();
    expect(response.status).toBe(200);
    const row = await context.prisma.accessRequest.findFirst({
      where: { email: "ticket@videira.test" },
    });
    expect(row?.status).toBe("pending");
  });
});
