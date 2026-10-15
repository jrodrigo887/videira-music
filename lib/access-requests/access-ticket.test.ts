import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/auth-config", () => ({
  readAuthEnvConfig: vi.fn(() => ({
    secret: "test-secret-at-least-32-characters-long",
    baseUrl: "http://localhost:3000",
  })),
}));

import {
  accessTicketCookieOptions,
  readAccessTicket,
  signAccessTicket,
} from "./access-ticket";

describe("access ticket", () => {
  const now = 1_700_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips email, name and 15 minute expiry", () => {
    const token = signAccessTicket({
      email: "User@Example.com",
      name: "User",
      now,
    });
    expect(readAccessTicket(token, now + 14 * 60_000)).toEqual({
      email: "user@example.com",
      name: "User",
    });
  });

  it("rejects expired tickets", () => {
    const token = signAccessTicket({ email: "a@b.test", name: "A", now });
    expect(readAccessTicket(token, now + 16 * 60_000)).toBeUndefined();
  });

  it("rejects tampered signatures", () => {
    const token = signAccessTicket({ email: "a@b.test", name: "A", now });
    const tampered = `${token}x`;
    expect(readAccessTicket(tampered, now)).toBeUndefined();
  });

  it("cookie options include HttpOnly and Max-Age 900", () => {
    const opts = accessTicketCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.maxAge).toBe(900);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
  });

  it("sets Secure only in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(accessTicketCookieOptions().secure).toBe(true);
    vi.stubEnv("NODE_ENV", "development");
    expect(accessTicketCookieOptions().secure).toBeUndefined();
    vi.unstubAllEnvs();
  });
});
