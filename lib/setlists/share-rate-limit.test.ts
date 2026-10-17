import { afterEach, describe, expect, it } from "vitest";

import {
  getInviteTokenRateLimiter,
  resetInviteTokenRateLimiterForTests,
} from "@/lib/invites/invite-rate-limit";

import {
  getShareTokenRateLimiter,
  resetShareTokenRateLimiterForTests,
} from "./share-rate-limit";

describe("share token rate limit", () => {
  afterEach(() => {
    resetShareTokenRateLimiterForTests();
    resetInviteTokenRateLimiterForTests();
  });

  it("uses a separate limiter instance from invite codes", () => {
    const share = getShareTokenRateLimiter();
    const invite = getInviteTokenRateLimiter();
    const ip = "203.0.113.10";
    const now = 1_700_000_000_000;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      share.recordFailure(ip, now);
    }
    expect(share.check(ip, now).allowed).toBe(false);
    expect(invite.check(ip, now).allowed).toBe(true);
  });

  it("blocks after the 11th failure within 15 minutes", () => {
    const limiter = getShareTokenRateLimiter();
    const ip = "203.0.113.11";
    const now = 1_700_000_000_000;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      limiter.recordFailure(ip, now);
    }
    expect(limiter.check(ip, now).allowed).toBe(false);
    limiter.recordFailure(ip, now);
    expect(limiter.check(ip, now).allowed).toBe(false);
  });
});
