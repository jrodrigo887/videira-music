import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getInviteTokenRateLimiter,
  resetInviteTokenRateLimiterForTests,
} from "@/lib/invites/invite-rate-limit";
import {
  getShareTokenRateLimiter,
  resetShareTokenRateLimiterForTests,
} from "@/lib/setlists/share-rate-limit";

import { proxy } from "./proxy";

function conviteRequest(ip: string): NextRequest {
  return new NextRequest("http://localhost/convite/invalid-token", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("proxy login wall", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function songsRequest(): NextRequest {
    return new NextRequest("http://localhost/songs");
  }

  it("redirects to /entrar when login is required", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_LOCALHOST", "false");

    const response = proxy(songsRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/entrar");
    expect(response.headers.get("location")).toContain("next=%2Fsongs");
  });

  it("lets protected routes through when DEV_LOCALHOST is true", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_LOCALHOST", "true");

    const response = proxy(songsRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps the login wall in production even when DEV_LOCALHOST is true", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_LOCALHOST", "true");

    const response = proxy(songsRequest());

    expect(response.headers.get("location")).toContain("/entrar");
  });
});

describe("proxy access request submission", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows POST /api/access-requests without session when the login wall is on", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_LOCALHOST", "true");

    const response = proxy(
      new NextRequest("http://localhost/api/access-requests", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects POST /api/access-requests/:id/approve without session", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_LOCALHOST", "true");

    const response = proxy(
      new NextRequest("http://localhost/api/access-requests/abc/approve", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/entrar");
  });
});

function shareRequest(ip: string): NextRequest {
  return new NextRequest("http://localhost/s/invalid-code", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("proxy public setlist path", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetShareTokenRateLimiterForTests();
  });

  it("does not redirect /s/{code} to /entrar", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_LOCALHOST", "false");

    const response = proxy(shareRequest("198.51.100.20"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("responds 429 on /s when the IP is blocked", () => {
    const ip = "198.51.100.21";
    const now = 1_700_000_000_000;
    const limiter = getShareTokenRateLimiter();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      limiter.recordFailure(ip, now);
    }

    const response = proxy(shareRequest(ip));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toMatch(/^[1-9]\d*$/);
  });

  it("allows POST /api/billing/webhook without session", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_LOCALHOST", "false");

    const response = proxy(
      new NextRequest("http://localhost/api/billing/webhook", { method: "POST" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("proxy invite rate limit (AUTH-20)", () => {
  afterEach(() => {
    resetInviteTokenRateLimiterForTests();
  });

  it("responds 429 with Retry-After on /convite when the IP is blocked", () => {
    const ip = "198.51.100.4";
    const now = 1_700_000_000_000;
    const limiter = getInviteTokenRateLimiter();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      limiter.recordFailure(ip, now);
    }

    const response = proxy(conviteRequest(ip));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toMatch(/^[1-9]\d*$/);
  });

  it("allows /convite when the IP is not blocked", () => {
    const response = proxy(conviteRequest("198.51.100.5"));
    expect(response.status).toBe(200);
  });
});
