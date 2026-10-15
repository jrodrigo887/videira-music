import { afterEach, describe, expect, it } from "vitest";

import { getInviteTokenRateLimiter, resetInviteTokenRateLimiterForTests } from "@/lib/invites/invite-rate-limit";

import { createInviteRateLimitResponse } from "./convite-rate-limit-http";

describe("createInviteRateLimitResponse (AUTH-20)", () => {
  afterEach(() => {
    resetInviteTokenRateLimiterForTests();
  });

  it("returns null while under the failure threshold", () => {
    const ip = "203.0.113.10";
    const now = 1_700_000_000_000;
    getInviteTokenRateLimiter().recordFailure(ip, now);

    expect(createInviteRateLimitResponse(ip, now)).toBeNull();
  });

  it("returns 429 with Retry-After after 10 invalid attempts from the same IP", () => {
    const ip = "203.0.113.10";
    const now = 1_700_000_000_000;
    const limiter = getInviteTokenRateLimiter();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      limiter.recordFailure(ip, now);
    }

    const response = createInviteRateLimitResponse(ip, now);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(429);
    expect(response!.headers.get("Retry-After")).toMatch(/^[1-9]\d*$/);
  });
});
